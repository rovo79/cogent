import * as fs from 'fs/promises';
import * as path from 'path';
import { Tool } from '../types';

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
        const filePath = String(args.path);
        ctx.writeUserMessage(`Reading file: ${filePath}`);
        return fs.readFile(filePath, 'utf8');
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
        const root = args.path ? String(args.path) : ctx.cwd;
        const maxDepth = typeof args.depth === 'number' ? Math.max(0, Math.floor(Number(args.depth))) : 1;
        const MAX_RESULTS = 200;
        const results: Array<{ path: string; size: number }> = [];
        ctx.writeUserMessage(`Listing directory ${root} (depth ${maxDepth})`);

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
                const relativeName = prefix ? path.join(prefix, entry.name) : entry.name;
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

        await walk(root, maxDepth);
        return results;
    },
};
