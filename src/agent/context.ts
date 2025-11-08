import * as fs from 'fs/promises';
import * as path from 'path';

export interface ContextSummary {
    files: string[];
    changedFiles: string[];
    gitBranch?: string;
    recentCommits?: string[];
    projectSignals?: string[];
}

async function listWorkspaceFiles(root: string, depth = 1): Promise<string[]> {
    if (depth < 0) {
        return [];
    }

    const entries = await fs.readdir(root, { withFileTypes: true });
    const items: string[] = [];
    for (const entry of entries) {
        if (entry.name.startsWith('.git')) {
            continue;
        }
        const fullPath = path.join(root, entry.name);
        if (entry.isDirectory()) {
            const nested = await listWorkspaceFiles(fullPath, depth - 1);
            items.push(...nested.map((name) => path.join(entry.name, name)));
        } else {
            items.push(entry.name);
        }
    }
    return items.sort();
}

export async function buildContextSummary(cwd: string): Promise<ContextSummary> {
    const files = await listWorkspaceFiles(cwd, 1);
    return {
        files,
        changedFiles: [],
    };
}
