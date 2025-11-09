import * as fs from 'fs/promises';
import * as os from 'os';
import * as path from 'path';

const AUDIT_DIRECTORY = process.env.COGENT_AUDIT_DIR ?? path.join(os.homedir(), '.cogent');
const AUDIT_FILE = path.join(AUDIT_DIRECTORY, 'audit.log');
let warnedAboutFailure = false;

async function ensureDirectory(): Promise<void> {
    await fs.mkdir(AUDIT_DIRECTORY, { recursive: true });
}

export async function recordAudit(event: Record<string, unknown>): Promise<void> {
    const line = `${new Date().toISOString()} ${JSON.stringify(event)}\n`;
    try {
        await ensureDirectory();
        await fs.appendFile(AUDIT_FILE, line, 'utf8');
    } catch (error) {
        if (!warnedAboutFailure) {
            warnedAboutFailure = true;
            console.warn(`Failed to record audit event: ${(error as Error).message}`);
        }
    }
}
