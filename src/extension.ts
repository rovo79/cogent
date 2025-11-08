import * as vscode from 'vscode';
import { registerToolUserChatParticipant } from './toolParticipant';
import { FileReadTool, FileWriteTool, FileUpdateTool, CommandRunTool, ApplyDiffTool } from './tools';
import { registerTool } from './mcp/registry';
import { readFileTool } from './mcp/tools/files';
import { prepareHotspotDiffTool, applyHotspotPatchTool } from './mcp/tools/demoHotspots';
import { DiffView } from './components/DiffView';
import { Logger } from './components/Logger';
import { buildContextSummary } from './agent/context';
import { DeterministicLLMClient, CompletionUsage } from './agent/demoLLM';
import { makePlan } from './agent/planner';
import { validatePlan, PlanValidationError } from './agent/planValidator';
import { runPlan, ExecContext } from './agent/execution/execManager';

export function activate(context: vscode.ExtensionContext) {
    const logger = Logger.getInstance();
    logger.info('Cogent extension is now active!');

    // Register tools
    context.subscriptions.push(
        vscode.lm.registerTool('cogent_readFile', new FileReadTool()),
        vscode.lm.registerTool('cogent_writeFile', new FileWriteTool()),
        vscode.lm.registerTool('cogent_updateFile', new FileUpdateTool()),
        vscode.lm.registerTool('cogent_runCommand', new CommandRunTool()),
        vscode.lm.registerTool('cogent_applyDiff', new ApplyDiffTool())
    );

    // Populate internal MCP registry
    registerTool(readFileTool);
    registerTool(prepareHotspotDiffTool);
    registerTool(applyHotspotPatchTool);

    // Register the tool participant
    registerToolUserChatParticipant(context);

    const deterministicLLM = new DeterministicLLMClient();

    const demoCommand = vscode.commands.registerCommand('cogent.refactorHotspots', async () => {
        const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
        if (!workspaceFolder) {
            void vscode.window.showErrorMessage('Cogent demo requires an open workspace.');
            return;
        }

        const cwd = workspaceFolder.uri.fsPath;
        const env = Object.fromEntries(
            Object.entries(process.env).filter((entry): entry is [string, string] => typeof entry[1] === 'string')
        );

        try {
            logger.info('Starting Cogent Refactor Hotspots demo command');
            const summary = await buildContextSummary(cwd);
            const summaryText = JSON.stringify(summary, null, 2);

            let completionUsage: CompletionUsage | undefined;
            const plan = await makePlan({
                goal: 'Demonstrate deterministic hotspot refactor loop',
                contextSummary: summaryText,
                llm: async (prompt: string) => {
                    const completion = await deterministicLLM.complete(prompt);
                    completionUsage = completion.usage;
                    return completion.text;
                },
            });

            validatePlan(plan, {
                maxSteps: 6,
                maxTokenBudget: 400,
                allowedTools: ['read_file', 'prepare_hotspot_diff', 'apply_hotspot_patch'],
            });

            const execContext: ExecContext = {
                cwd,
                env,
                approval: async (reason, preview) => {
                    const detail = preview
                        ? `${preview.slice(0, 1500)}${preview.length > 1500 ? '\n... (truncated)' : ''}`
                        : undefined;
                    const choice = await vscode.window.showInformationMessage(
                        reason,
                        { modal: true, detail },
                        'Approve',
                        'Reject'
                    );
                    return choice === 'Approve';
                },
                writeUserMessage: (msg) => {
                    logger.info(msg);
                },
                slots: new Map(),
            };

            await runPlan(plan, execContext);

            if (completionUsage) {
                logger.info(
                    `LLM usage - prompt tokens: ${completionUsage.promptTokens}, response tokens: ${completionUsage.responseTokens}, latency: ${completionUsage.latencyMs}ms`
                );
            }

            void vscode.window.showInformationMessage('Cogent hotspot refactor demo completed successfully.');
        } catch (error) {
            let message = 'Unknown error';
            if (error instanceof PlanValidationError) {
                message = error.message;
            } else if (error instanceof Error) {
                message = error.message;
            }
            logger.error(`Hotspot demo failed: ${message}`);
            void vscode.window.showErrorMessage(`Cogent hotspot refactor failed: ${message}`);
        }
    });

    context.subscriptions.push(demoCommand);
}

export function deactivate() {
    Logger.getInstance().dispose();
    DiffView.dispose();
}