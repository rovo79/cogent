import * as path from 'path';
import * as fs from 'fs/promises';
import { Tool } from '../types';
import { recordAudit } from '../../telemetry/audit';

interface PreparedPatch {
    path: string;
    diff: string;
    start_line: number;
    end_line: number;
}

const SEARCH_BLOCK = `# Hotspot Report\n\n- src/agent/context.ts needs better summary metadata\n- src/agent/plans.ts missing token estimates`;
const REPLACE_BLOCK = `# Hotspot Report\n\n- src/agent/context.ts now includes richer change tracking\n- src/agent/planner.ts measures token budgets for every step\n- src/mcp/registry enforces deterministic demo guardrails`;

export const prepareHotspotDiffTool: Tool = {
    name: 'prepare_hotspot_diff',
    description: 'Prepare a deterministic patch for the hotspot demo file',
    io: {
        params: [
            {
                name: 'path',
                type: 'string',
                required: true,
            },
        ],
        returns: 'object',
    },
    risk: 'read',
    preferredMode: 'MCP',
    async run(args, ctx) {
        const relativePath = String(args.path);
        ctx.writeUserMessage(`Preparing demo diff for ${relativePath}`);
        const patch: PreparedPatch = {
            path: relativePath,
            diff: `<<<<<<< SEARCH\n${SEARCH_BLOCK}\n=======\n${REPLACE_BLOCK}\n>>>>>>> REPLACE`,
            start_line: 1,
            end_line: 4,
        };
        return patch;
    },
};

function applySearchReplaceDiff(content: string, diff: string): string {
    const match = diff.match(/<<<<<<< SEARCH\n([\s\S]*?)\n=======\n([\s\S]*?)\n>>>>>>> REPLACE/);
    if (!match) {
        throw new Error('Invalid diff format');
    }
    const [, searchBlock, replaceBlock] = match;
    if (!content.includes(searchBlock)) {
        throw new Error('Search block not found in target file');
    }
    return content.replace(searchBlock, replaceBlock);
}

export const applyHotspotPatchTool: Tool = {
    name: 'apply_hotspot_patch',
    description: 'Apply the deterministic hotspot patch to the workspace',
    io: {
        params: [
            { name: 'patch', type: 'object', required: true },
        ],
        returns: 'string',
    },
    risk: 'write',
    preferredMode: 'MCP',
    async run(args, ctx) {
        const patch = args.patch as PreparedPatch;
        const relativePath = String(patch.path);
        const diff = String(patch.diff);
        const cwd = ctx.cwd;
        const fullPath = path.resolve(cwd, relativePath);
        const before = await fs.readFile(fullPath, 'utf8');
        const after = applySearchReplaceDiff(before, diff);
        await fs.writeFile(fullPath, after, 'utf8');
        ctx.writeUserMessage(`Applied hotspot patch to ${relativePath}`);
        await recordAudit({
            type: 'apply_patch',
            tool: 'apply_hotspot_patch',
            files: [relativePath],
        });
        return 'patch_applied';
    },
};
