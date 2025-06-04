import * as vscode from 'vscode';

export class Logger {
    private static instance: Logger;
    private channel: vscode.OutputChannel;

    private constructor() {
        this.channel = vscode.window.createOutputChannel('Cogent', { log: true });
        // Force show the channel on construction
        this.channel.show(true);

        // Log the debug configuration value
        const debugEnabled = vscode.workspace.getConfiguration('cogent').get('debug');
        this.channel.appendLine(`DEBUG CONFIG: ${debugEnabled}`);
    }

    static getInstance(): Logger {
        if (!Logger.instance) {
            Logger.instance = new Logger();
        }
        return Logger.instance;
    }

    private timestamp(): string {
        return new Date().toISOString();
    }

    info(message: string): void {
        this.channel.appendLine(`INFO: ${message}`);
    }

    warn(message: string): void {
        this.channel.appendLine(`WARN: ${message}`);
    }

    error(message: string | Error): void {
        if (message instanceof Error) {
            this.channel.appendLine(`ERROR: ${message.stack || message.message}`);
        } else {
            this.channel.appendLine(`ERROR: ${message}`);
        }
    }

    debug(message: string): void {
        // Default to true if workspace is not available
        const debugEnabled = !vscode.workspace.workspaceFolders ?
            true :
            vscode.workspace.getConfiguration('cogent').get('debug', true);

        if (debugEnabled) {
            this.channel.appendLine(`[${this.timestamp()}] 🔍 DEBUG: ${message}`);
            // Force show on debug messages to ensure visibility
            this.channel.show(true);
        }
    }

    show(): void {
        this.channel.show();
    }

    dispose(): void {
        this.channel.dispose();
    }
}
