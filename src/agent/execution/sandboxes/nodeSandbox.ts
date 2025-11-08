import { spawn } from 'child_process';

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
    return new Promise<NodeSandboxResult>((resolve, reject) => {
        const child = spawn('node', ['-e', options.code], {
            cwd: options.cwd,
            env: { ...process.env, ...options.env },
        });

        let stdout = '';
        let stderr = '';

        child.stdout.on('data', (chunk: Buffer) => {
            stdout += chunk.toString();
        });

        child.stderr.on('data', (chunk: Buffer) => {
            stderr += chunk.toString();
        });

        child.on('close', (code) => {
            resolve({
                stdout,
                stderr,
                exitCode: typeof code === 'number' ? code : -1,
            });
        });

        child.on('error', (error) => {
            reject(error);
        });
    });
}
