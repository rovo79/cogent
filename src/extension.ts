import * as vscode from 'vscode';
import { registerToolUserChatParticipant } from './toolParticipant';
import { FileReadTool, FileWriteTool, FileUpdateTool, CommandRunTool, ApplyDiffTool } from './tools';
import { DiffView } from './components/DiffView';
import { Logger } from './components/Logger';

export function activate(context: vscode.ExtensionContext) {
    const logger = Logger.getInstance();
    // Show the output channel immediately
    logger.show();

    try {
        logger.info('🚀 Phase 1: Cogent extension activating...');
        logger.info('⚡ Phase 1: Starting activation sequence');
        logger.info(`Workspace has folders: ${!!vscode.workspace.workspaceFolders}`);
        logger.info('⚡ Version: 1.0.1');
        logger.info(`Extension ID: ${context.extension.id}`);
        logger.info(`Extension Path: ${context.extensionPath}`);
        logger.debug(`Has vscode.lm API: ${!!vscode.lm}`);
        logger.debug('Starting tool registration');

        // Register tools
        context.subscriptions.push(
            vscode.lm.registerTool('cogent_readFile', new FileReadTool()),
            vscode.lm.registerTool('cogent_writeFile', new FileWriteTool()),
            vscode.lm.registerTool('cogent_updateFile', new FileUpdateTool()),
            vscode.lm.registerTool('cogent_runCommand', new CommandRunTool()),
            vscode.lm.registerTool('cogent_applyDiff', new ApplyDiffTool())
        );
        logger.debug('Tools registered successfully');

        // Register the tool participant
        logger.debug('Registering tool participant...');
        registerToolUserChatParticipant(context);
        logger.info('✅ Cogent extension activated successfully');

        // Register the checkModels command ONLY if the file exists (dev only)
        if (process.env.NODE_ENV === 'development') {
            try {
                const { checkAvailableModels } = require('./test/check-models');
                context.subscriptions.push(
                    vscode.commands.registerCommand('cogent.checkModels', checkAvailableModels)
                );
            } catch (e) {
                logger.warn('checkAvailableModels not available in production build.');
            }
        }
    } catch (error) {
        logger.error('❌ Error during extension activation:');
        logger.error(error instanceof Error ? error : String(error));
        throw error;
    }
}

export function deactivate() {
    Logger.getInstance().dispose();
    DiffView.dispose();
}
