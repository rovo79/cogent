import * as fs from 'fs/promises';
import * as path from 'path';
import { Tool } from '../types';

function resolveWorkspacePath(cwd: string, target: string): { absolute: string; relative: string } {
    const normalizedTarget = target.trim();
    const absolutePath = path.resolve(cwd, normalizedTarget);
    const relativePath = path.relative(cwd, absolutePath);

    if (relativePath.startsWith('..') || path.isAbsolute(relativePath)) {
        throw new Error(`Path ${normalizedTarget} escapes the workspace root`);
    }

    return { absolute: absolutePath, relative: toPosix(relativePath || '.') };
}

function toPosix(value: string): string {
    return value.split(path.sep).join(path.posix.sep);
}

export const readFileTool: Tool = {
    name: 'read_file',
    description: 'Read file contents as text',
    io: {
        params: [
            {
                name: 'path',
                type: 'string',
                required: true,
            },
        ],
        returns: 'string',
    },
    risk: 'read',
    preferredMode: 'MCP',
    async run(args, ctx) {
        const inputPath = typeof args.path === 'string' ? args.path : String(args.path);
        const { absolute, relative } = resolveWorkspacePath(ctx.cwd, inputPath);
        ctx.writeUserMessage(`Reading file: ${relative}`);
        return fs.readFile(absolute, 'utf8');
    },
};

export const listDirectoryTool: Tool = {
    name: 'list_directory',
    description: 'List files within a directory with basic metadata',
    io: {
        params: [
            {
                name: 'path',
                type: 'string',
                required: false,
            },
            {
                name: 'depth',
                type: 'number',
                required: false,
            },
        ],
        returns: 'Array<{ path: string; size: number }>',
    },
    risk: 'read',
    preferredMode: 'MCP',
    async run(args, ctx) {
        const target = args.path ? String(args.path) : '.';
        const { absolute: root, relative } = resolveWorkspacePath(ctx.cwd, target);
        const maxDepth = typeof args.depth === 'number' ? Math.max(0, Math.floor(Number(args.depth))) : 1;
        const MAX_RESULTS = 200;
        const results: Array<{ path: string; size: number }> = [];
        ctx.writeUserMessage(`Listing directory ${relative} (depth ${maxDepth})`);

        async function walk(current: string, depth: number, prefix = ''): Promise<void> {
            if (depth < 0) {
                return;
            }
            if (results.length >= MAX_RESULTS) {
                return;
            }
            const entries = await fs.readdir(current, { withFileTypes: true });
            for (const entry of entries) {
                if (entry.name.startsWith('.git')) {
                    continue;
                }
                const full = path.join(current, entry.name);
                const nextRelative = prefix ? path.join(prefix, entry.name) : entry.name;
                const relativeName = toPosix(nextRelative);
                if (entry.isDirectory()) {
                    await walk(full, depth - 1, relativeName);
                } else {
                    try {
                        const stat = await fs.stat(full);
                        results.push({ path: relativeName, size: stat.size });
                        if (results.length >= MAX_RESULTS) {
                            return;
                        }
                    } catch {
                        // Ignore unreadable files.
                    }
                }
            }
        }

        await walk(root, maxDepth, relative === '.' ? '' : relative);
        return results;
    },
};
