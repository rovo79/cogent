import * as fs from 'fs/promises';
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
    preferredMode: 'MCP',
    async run(args, ctx) {
        const path = String(args.path);
        ctx.writeUserMessage(`Reading file: ${path}`);
        return fs.readFile(path, 'utf8');
    },
};
