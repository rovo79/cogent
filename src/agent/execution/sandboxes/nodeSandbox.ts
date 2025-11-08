import { spawn } from 'child_process';

const DEFAULT_TIMEOUT_MS = 8_000;
const MEMORY_FLAG = '--max-old-space-size=64';
const OUTPUT_LIMIT = 512;

export interface NodeSandboxOptions {
    code: string;
    cwd: string;
    env: Record<string, string>;
}

export interface NodeSandboxResult {
    stdout: string;
    stderr: string;
    exitCode: number;
}

export async function runInNodeSandbox(options: NodeSandboxOptions): Promise<NodeSandboxResult> {
    const runtime = `
const vm = require('vm');
const fs = require('fs');
const path = require('path');
const allowed = new Set(['fs', 'path', 'crypto']);
const enableNet = process.env.COGENT_ENABLE_NET === 'true';
if (enableNet) {
    allowed.add('net');
}
const baseDir = process.cwd();

function resolveWithinBase(target) {
    const resolved = path.resolve(baseDir, target);
    if (!resolved.startsWith(baseDir)) {
        throw new Error('Access outside sandbox boundary');
    }
    return resolved;
}

const jailedFs = {
    readFileSync(file, encoding) {
        return fs.readFileSync(resolveWithinBase(file), encoding);
    },
    writeFileSync(file, data, encoding) {
        return fs.writeFileSync(resolveWithinBase(file), data, encoding);
    },
    readdirSync(dir, options) {
        return fs.readdirSync(resolveWithinBase(dir), options);
    },
    statSync(target, options) {
        return fs.statSync(resolveWithinBase(target), options);
    },
    promises: {
        readFile(file, encoding) {
            return fs.promises.readFile(resolveWithinBase(file), encoding);
        },
        writeFile(file, data, encoding) {
            return fs.promises.writeFile(resolveWithinBase(file), data, encoding);
        },
        readdir(dir, options) {
            return fs.promises.readdir(resolveWithinBase(dir), options);
        },
        stat(target, options) {
            return fs.promises.stat(resolveWithinBase(target), options);
        },
    },
};

function sandboxRequire(name) {
    if (!allowed.has(name)) {
        throw new Error('Module not allowed: ' + name);
    }
    if (name === 'fs') {
        return jailedFs;
    }
    if (name === 'path') {
        return require('path');
    }
    if (name === 'crypto') {
        return require('crypto');
    }
    if (name === 'net' && enableNet) {
        return require('net');
    }
    throw new Error('Module not allowed: ' + name);
}

const sandboxConsole = {
    log: (...args) => console.log(...args),
    error: (...args) => console.error(...args),
    warn: (...args) => console.warn(...args),
};

const sandbox = {
    require: sandboxRequire,
    console: sandboxConsole,
    process: {
        env: {},
        cwd: () => baseDir,
    },
    Buffer,
    setTimeout,
    clearTimeout,
    setInterval,
    clearInterval,
};

const source = Buffer.from(process.env.COGENT_CODE, 'base64').toString('utf8');

try {
    vm.runInNewContext(source, sandbox, { timeout: ${DEFAULT_TIMEOUT_MS} });
    process.exit(0);
} catch (error) {
    const message = error && error.stack ? error.stack : String(error);
    console.error(message);
    process.exit(1);
}
`;

    return new Promise<NodeSandboxResult>((resolve, reject) => {
        const child = spawn('node', [MEMORY_FLAG, '-e', runtime], {
            cwd: options.cwd,
            env: {
                ...process.env,
                ...options.env,
                COGENT_CODE: Buffer.from(options.code, 'utf8').toString('base64'),
            },
            stdio: ['ignore', 'pipe', 'pipe'],
        });

        let stdout = '';
        let stderr = '';
        let timeoutHandle: NodeJS.Timeout | undefined;

        const finalize = (code: number) => {
            if (timeoutHandle) {
                clearTimeout(timeoutHandle);
            }
            resolve({
                stdout: stdout.slice(0, OUTPUT_LIMIT),
                stderr: stderr.slice(0, OUTPUT_LIMIT),
                exitCode: code,
            });
        };

        timeoutHandle = setTimeout(() => {
            stderr += `Execution timed out after ${DEFAULT_TIMEOUT_MS}ms`;
            child.kill('SIGKILL');
        }, DEFAULT_TIMEOUT_MS + 100);

        child.stdout.on('data', (chunk: Buffer) => {
            stdout += chunk.toString();
        });

        child.stderr.on('data', (chunk: Buffer) => {
            stderr += chunk.toString();
        });

        child.on('close', (code) => {
            finalize(typeof code === 'number' ? code : -1);
        });

        child.on('error', (error) => {
            if (timeoutHandle) {
                clearTimeout(timeoutHandle);
            }
            reject(error);
        });
    });
}
