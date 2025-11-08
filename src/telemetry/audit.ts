import * as fs from 'fs/promises';
import * as path from 'path';

const AUDIT_FILE = path.join(process.cwd(), '.cogent', 'audit.log');

async function ensureDirectory(): Promise<void> {
    await fs.mkdir(path.dirname(AUDIT_FILE), { recursive: true });
}

export async function recordAudit(event: Record<string, unknown>): Promise<void> {
    await ensureDirectory();
    const line = `${new Date().toISOString()} ${JSON.stringify(event)}\n`;
    await fs.appendFile(AUDIT_FILE, line, 'utf8');
}
