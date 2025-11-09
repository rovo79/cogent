import * as fs from 'fs/promises';
import { Dirent } from 'fs';
import * as path from 'path';
import { createHash } from 'crypto';
import { promisify } from 'util';
import { execFile } from 'child_process';

const execFileAsync = promisify(execFile);

export interface WorkspaceFileSummary {
    path: string;
    size: number;
    hash?: string;
}

export interface ContextSummary {
    files: WorkspaceFileSummary[];
    changedFiles: string[];
    gitBranch?: string;
    recentCommits?: string[];
    projectSignals?: string[];
    totalFiles: number;
    truncated: boolean;
}

export interface ContextSummaryOptions {
    maxFiles?: number;
    maxDepth?: number;
    includeHashes?: boolean;
}

const DEFAULT_MAX_FILES = 60;
const DEFAULT_DEPTH = 2;
const HASH_SIZE_LIMIT = 128 * 1024; // 128KB

export async function buildContextSummary(
    cwd: string,
    options: ContextSummaryOptions = {}
): Promise<ContextSummary> {
    const maxFiles = options.maxFiles ?? DEFAULT_MAX_FILES;
    const maxDepth = options.maxDepth ?? DEFAULT_DEPTH;
    const includeHashes = options.includeHashes ?? true;

    const { files, totalFiles, truncated } = await collectWorkspaceFiles({
        root: cwd,
        maxFiles,
        maxDepth,
        includeHashes,
    });

    const [changedFiles, gitBranch, recentCommits, projectSignals] = await Promise.all([
        getChangedFiles(cwd),
        getGitBranch(cwd),
        getRecentCommits(cwd),
        detectProjectSignals(cwd),
    ]);

    return {
        files,
        changedFiles,
        gitBranch,
        recentCommits,
        projectSignals,
        totalFiles,
        truncated,
    };
}

async function collectWorkspaceFiles(options: {
    root: string;
    maxFiles: number;
    maxDepth: number;
    includeHashes: boolean;
}): Promise<{ files: WorkspaceFileSummary[]; totalFiles: number; truncated: boolean }> {
    const queue: Array<{ dir: string; depth: number; prefix: string }> = [
        { dir: options.root, depth: options.maxDepth, prefix: '' },
    ];
    const files: WorkspaceFileSummary[] = [];
    let totalFiles = 0;
    let truncated = false;

    while (queue.length > 0) {
        const current = queue.shift();
        if (!current) {
            break;
        }
        let entries: Dirent[];
        try {
            entries = await fs.readdir(current.dir, { withFileTypes: true });
        } catch {
            continue;
        }
        for (const entry of entries) {
            if (entry.name.startsWith('.git')) {
                continue;
            }
            const full = path.join(current.dir, entry.name);
            const relative = current.prefix ? path.join(current.prefix, entry.name) : entry.name;
            if (entry.isDirectory()) {
                if (current.depth > 0) {
                    queue.push({ dir: full, depth: current.depth - 1, prefix: relative });
                }
                continue;
            }
            totalFiles += 1;
            if (files.length >= options.maxFiles) {
                truncated = true;
                continue;
            }
            try {
                const stat = await fs.stat(full);
                const summary: WorkspaceFileSummary = {
                    path: relative,
                    size: stat.size,
                };
                if (options.includeHashes && stat.size <= HASH_SIZE_LIMIT) {
                    const content = await fs.readFile(full);
                    summary.hash = createHash('sha1').update(content).digest('hex');
                }
                files.push(summary);
            } catch {
                // Ignore files we cannot access.
            }
        }
    }

    return { files, totalFiles, truncated };
}

async function getChangedFiles(cwd: string): Promise<string[]> {
    try {
        const { stdout } = await execFileAsync('git', ['status', '--porcelain'], { cwd });
        return stdout
            .split('\n')
            .map((line) => line.trim())
            .filter(Boolean)
            .map((line) => line.slice(3));
    } catch {
        return [];
    }
}

async function getGitBranch(cwd: string): Promise<string | undefined> {
    try {
        const { stdout } = await execFileAsync('git', ['rev-parse', '--abbrev-ref', 'HEAD'], { cwd });
        return stdout.trim();
    } catch {
        return undefined;
    }
}

async function getRecentCommits(cwd: string): Promise<string[]> {
    try {
        const { stdout } = await execFileAsync('git', ['log', '--pretty=format:%h %s', '-n', '5'], { cwd });
        return stdout.split('\n').filter(Boolean);
    } catch {
        return [];
    }
}

async function detectProjectSignals(cwd: string): Promise<string[]> {
    const signals: string[] = [];
    const packageJsonPath = path.join(cwd, 'package.json');
    try {
        const packageContent = await fs.readFile(packageJsonPath, 'utf8');
        const pkg = JSON.parse(packageContent) as {
            scripts?: Record<string, string>;
            dependencies?: Record<string, string>;
            devDependencies?: Record<string, string>;
        };
        if (pkg.scripts) {
            const scriptNames = Object.keys(pkg.scripts).slice(0, 6).join(', ');
            signals.push(`npm scripts: ${scriptNames}`);
        }
        if (pkg.dependencies) {
            const deps = Object.keys(pkg.dependencies).slice(0, 6).join(', ');
            signals.push(`deps: ${deps}`);
        }
        if (pkg.devDependencies) {
            const devDeps = Object.keys(pkg.devDependencies).slice(0, 4).join(', ');
            signals.push(`devDeps: ${devDeps}`);
        }
    } catch {
        // ignore
    }

    for (const filename of ['tsconfig.json', 'pnpm-lock.yaml', 'yarn.lock', '.nvmrc']) {
        try {
            await fs.access(path.join(cwd, filename));
            signals.push(`found: ${filename}`);
        } catch {
            // ignore missing
        }
    }

    return signals;
}
