import * as vscode from 'vscode';
import { registerToolUserChatParticipant } from './toolParticipant';
import { FileReadTool, FileWriteTool, FileUpdateTool, CommandRunTool, ApplyDiffTool } from './tools';
import { registerTool } from './mcp/registry';
import { listDirectoryTool, readFileTool } from './mcp/tools/files';
import { DiffView } from './components/DiffView';
import { Logger } from './components/Logger';
import { runAgent } from './agent/agent';
import { askApproval } from './ui/approvals';
import { ExecutionPolicies, ExecEvent } from './agent/execution/execManager';
import { PlanStep } from './agent/plans';

export function activate(context: vscode.ExtensionContext) {
    const logger = Logger.getInstance();
    logger.info('Cogent extension is now active!');

    const agentChannel = vscode.window.createOutputChannel('Cogent Agent');
    context.subscriptions.push(agentChannel);

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
    registerTool(listDirectoryTool);

    // Register the tool participant
    registerToolUserChatParticipant(context);

    context.subscriptions.push(
        vscode.commands.registerCommand('cogent.runPlan', async () => {
            const goal = await vscode.window.showInputBox({
                prompt: 'Enter the goal for Cogent to execute',
                placeHolder: 'e.g. Audit workspace structure and summarize findings',
            });
            if (!goal) {
                return;
            }

            const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
            if (!workspaceFolder) {
                vscode.window.showErrorMessage('Cogent requires an open workspace');
                return;
            }

            const model = await selectPlannerModel();
            if (!model) {
                vscode.window.showErrorMessage('No chat model is available for planning.');
                return;
            }

            const config = vscode.workspace.getConfiguration('cogent');
            const useFullWorkspace = config.get<boolean>('useFullWorkspace', false);
            const autoApproveList = config.get<string[]>('autoApprove', []);
            const autoApproveTools = new Set((autoApproveList ?? []).filter(Boolean));
            const allowShell = config.get<boolean>('tools.allowShell', false);
            const netAllowed = config.get<boolean>('tools.netAllowed', false);
            const timeoutMs = config.get<number>('exec.timeoutMs', 120_000);
            const memoryMb = config.get<number>('exec.memoryMb', 512);
            const allowedModules = (config.get<string[]>('exec.allowedNodeModules') ?? [
                'fs',
                'path',
                'os',
                'crypto',
                'util',
            ]).filter(Boolean);

            const policies: ExecutionPolicies = {
                autoApproveTools,
                allowRisks: {
                    exec: allowShell,
                    net: netAllowed,
                },
                sandbox: {
                    timeoutMs: Math.max(1000, timeoutMs),
                    memoryLimitMb: Math.max(128, memoryMb),
                    allowedModules,
                    maxOutputBytes: 8 * 1024,
                },
            };

            const contextOptions = useFullWorkspace
                ? { maxFiles: 120, maxDepth: 3 }
                : { maxFiles: 60, maxDepth: 2 };

            agentChannel.show(true);
            agentChannel.appendLine(`Goal: ${goal}`);

            const llm = async (prompt: string): Promise<string> => {
                const messages: vscode.LanguageModelChatMessage[] = [
                    {
                        role: vscode.LanguageModelChatMessageRole.User,
                        name: undefined,
                        content: [new vscode.LanguageModelTextPart(prompt)],
                    },
                ];
                const response = await model.sendRequest(messages, { justification: 'Cogent planner request' });
                let text = '';
                for await (const part of response.stream) {
                    if (part instanceof vscode.LanguageModelTextPart) {
                        text += part.value;
                    }
                }
                return text;
            };

            const onEvent = (event: ExecEvent) => {
                switch (event.type) {
                    case 'plan-started':
                        agentChannel.appendLine('Plan received.');
                        break;
                    case 'step-started':
                        agentChannel.appendLine(`▶ Step ${event.index + 1}: ${describeStep(event.step)}`);
                        break;
                    case 'step-completed':
                        agentChannel.appendLine(`✅ Step ${event.index + 1} complete: ${event.resultSummary}`);
                        break;
                    case 'step-failed':
                        agentChannel.appendLine(`❌ Step ${event.index + 1} failed: ${event.error}`);
                        break;
                    case 'approval-requested':
                        agentChannel.appendLine(`⚠️ Approval requested: ${event.request.reason}`);
                        break;
                    case 'plan-completed':
                        agentChannel.appendLine('Plan completed.');
                        break;
                    default:
                        break;
                }
            };

            try {
                await runAgent(goal, {
                    cwd: workspaceFolder.uri.fsPath,
                    llm,
                    writeUserMessage: (message) => agentChannel.appendLine(message),
                    approval: askApproval,
                    policies,
                    contextOptions,
                    onEvent,
                });
            } catch (error) {
                const message = error instanceof Error ? error.message : String(error);
                agentChannel.appendLine(`Agent failed: ${message}`);
                vscode.window.showErrorMessage(`Cogent agent failed: ${message}`);
            }
        })
    );
}

export function deactivate() {
    Logger.getInstance().dispose();
    DiffView.dispose();
}

async function selectPlannerModel(): Promise<vscode.LanguageModelChat | undefined> {
    const MODEL_SELECTOR: vscode.LanguageModelChatSelector = { vendor: 'copilot', family: 'claude-3.5-sonnet' };
    let [model] = await vscode.lm.selectChatModels(MODEL_SELECTOR);
    if (!model) {
        [model] = await vscode.lm.selectChatModels({ vendor: 'copilot', family: 'gpt-4o' });
    }
    return model;
}

function describeStep(step: PlanStep): string {
    switch (step.kind) {
        case 'useTool':
            return `use tool ${step.tool}`;
        case 'execCode':
            return `execute ${step.language} code`;
        case 'askApproval':
            return `request approval: ${step.reason}`;
        case 'summarize':
            return `summarize inputs (${step.inputs.length})`;
        default: {
            const _exhaustive: never = step;
            return _exhaustive;
        }
    }
}