import { spawn } from 'child_process';
import { promises as fs } from 'fs';
import * as os from 'os';
import * as path from 'path';
import { randomUUID } from 'crypto';

const REQUIRE_RE = /require\(['"]([^'"()]+)['"]\)/g;
const IMPORT_RE = /from\s+['"]([^'"()]+)['"]/g;

export interface NodeSandboxOptions {
    code: string;
    cwd: string;
    env: Record<string, string>;
    timeoutMs: number;
    memoryLimitMb: number;
    allowedModules: string[];
    maxOutputBytes: number;
}

export interface NodeSandboxResult {
    stdout: string;
    stderr: string;
    exitCode: number;
    timedOut: boolean;
    truncated: boolean;
}

export async function runInNodeSandbox(options: NodeSandboxOptions): Promise<NodeSandboxResult> {
    enforceModuleAllowList(options.code, options.allowedModules);

    const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'cogent-node-'));
    const scriptPath = path.join(tempDir, `${randomUUID()}.mjs`);
    await fs.writeFile(scriptPath, options.code, 'utf8');

    return new Promise<NodeSandboxResult>((resolve, reject) => {
        const args = [`--max-old-space-size=${options.memoryLimitMb}`, scriptPath];
        const child = spawn('node', args, {
            cwd: options.cwd,
            env: { ...process.env, ...options.env },
            stdio: ['ignore', 'pipe', 'pipe'],
        });

        let stdout = '';
        let stderr = '';
        let truncated = false;
        let timedOut = false;

        const limitStream = (buffer: string, chunk: Buffer): { value: string; truncated: boolean } => {
            const combined = buffer + chunk.toString();
            if (Buffer.byteLength(combined, 'utf8') <= options.maxOutputBytes) {
                return { value: combined, truncated: false };
            }
            const limited = combined.slice(0, options.maxOutputBytes);
            return { value: limited, truncated: true };
        };

        child.stdout.on('data', (chunk: Buffer) => {
            const next = limitStream(stdout, chunk);
            stdout = next.value;
            truncated = truncated || next.truncated;
        });

        child.stderr.on('data', (chunk: Buffer) => {
            const next = limitStream(stderr, chunk);
            stderr = next.value;
            truncated = truncated || next.truncated;
        });

        const timeout = setTimeout(() => {
            timedOut = true;
            child.kill('SIGKILL');
        }, options.timeoutMs);

        const cleanup = async () => {
            clearTimeout(timeout);
            try {
                await fs.rm(scriptPath, { force: true });
                await fs.rm(tempDir, { recursive: true, force: true });
            } catch (error) {
                // Swallow errors from cleanup to avoid masking primary failures.
            }
        };

        child.on('close', async (code) => {
            await cleanup();
            resolve({
                stdout,
                stderr,
                exitCode: typeof code === 'number' ? code : -1,
                timedOut,
                truncated,
            });
        });

        child.on('error', async (error) => {
            await cleanup();
            reject(error);
        });
    });
}

function enforceModuleAllowList(code: string, allowed: string[]): void {
    const allowSet = new Set(allowed);
    const violations = new Set<string>();

    const check = (match: RegExpExecArray | null) => {
        if (!match) {
            return;
        }
        const specifier = match[1];
        if (specifier.startsWith('.') || specifier.startsWith('/')) {
            return;
        }
        if (!allowSet.has(specifier)) {
            violations.add(specifier);
        }
    };

    let result: RegExpExecArray | null;
    // eslint-disable-next-line no-cond-assign
    while ((result = REQUIRE_RE.exec(code))) {
        check(result);
    }
    REQUIRE_RE.lastIndex = 0;
    // eslint-disable-next-line no-cond-assign
    while ((result = IMPORT_RE.exec(code))) {
        check(result);
    }
    IMPORT_RE.lastIndex = 0;

    if (violations.size > 0) {
        throw new Error(
            `Sandboxed code attempted to import disallowed modules: ${Array.from(violations).join(', ')}`
        );
    }
}
