import * as fs from 'fs/promises';
import * as path from 'path';

function getAuditFilePath(workspaceFolder: string): string {
    return path.join(workspaceFolder, '.cogent', 'audit.log');
}

async function ensureDirectory(workspaceFolder: string): Promise<void> {
    await fs.mkdir(path.join(workspaceFolder, '.cogent'), { recursive: true });
}

export async function recordAudit(event: Record<string, unknown>, workspaceFolder: string): Promise<void> {
    await ensureDirectory(workspaceFolder);
    const line = `${new Date().toISOString()} ${JSON.stringify(event)}\n`;
    await fs.appendFile(getAuditFilePath(workspaceFolder), line, 'utf8');
}
