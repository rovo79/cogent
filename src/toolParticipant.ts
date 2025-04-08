import { renderPrompt } from '@vscode/prompt-tsx';
import * as vscode from 'vscode';
import { ToolCallRound, ToolResultMetadata, ToolUserPrompt } from './toolsPrompt';

export interface TsxToolUserMetadata {
    toolCallsMetadata: ToolCallsMetadata;
}

export interface ToolCallsMetadata {
    toolCallRounds: ToolCallRound[];
    toolCallResults: Record<string, vscode.LanguageModelToolResult>;
}

interface ReadFileToolInput {
    paths: string[];
}

export function isTsxToolUserMetadata(obj: unknown): obj is TsxToolUserMetadata {
    return !!obj &&
        !!(obj as TsxToolUserMetadata).toolCallsMetadata &&
        Array.isArray((obj as TsxToolUserMetadata).toolCallsMetadata.toolCallRounds);
}

export function registerToolUserChatParticipant(context: vscode.ExtensionContext) {
    const handler: vscode.ChatRequestHandler = async (request: vscode.ChatRequest, chatContext: vscode.ChatContext, stream: vscode.ChatResponseStream, token: vscode.CancellationToken) => {
        // First, show available models
        const allModels = await vscode.lm.selectChatModels({});
        stream.markdown(`📋 Available Models:\n`);
        allModels.forEach(m => {
            stream.markdown(`- ${m.name || m.family}\n` +
                          `  - Max tokens: ${m.maxInputTokens}\n` +
                          `  - Vendor: ${m.vendor}\n`);
        });

        // Show available tools
        stream.markdown(`\n🛠️ Available Tools:\n`);
        vscode.lm.tools.forEach(tool => {
            stream.markdown(`- ${tool.name}\n` +
                          `  - Description: ${tool.description}\n` +
                          `  - Input Schema: ${JSON.stringify(tool.inputSchema, null, 2)}\n`);
        });

        // Then try to select our preferred model
        const MODEL_SELECTOR: vscode.LanguageModelChatSelector = { vendor: 'copilot', family: 'claude-3.5-sonnet' };
        let [model] = await vscode.lm.selectChatModels(MODEL_SELECTOR);

        // Add diagnostic information about the selected model
        if (model) {
            stream.markdown(`\n🤖 Selected model:\n` +
                          `- Model: ${model.name || model.family}\n` +
                          `- Max tokens: ${model.maxInputTokens}\n` +
                          `- Vendor: ${model.vendor}\n`);
        }

        if (!model) {
            [model] = await vscode.lm.selectChatModels({ vendor: 'copilot', family: 'gpt-4o' });
            if (!model) {
                stream.markdown("❌ No language model available.")
                return;
            } else {
                // Log fallback model info
                stream.markdown(`⚠️ Fallback to:\n` +
                              `- Model: ${model.name || model.family}\n` +
                              `- Max tokens: ${model.maxInputTokens}\n` +
                              `- Vendor: ${model.vendor}\n`);
            }
        }

        const useFullWorkspace = vscode.workspace.getConfiguration('cogent').get('use_full_workspace', false);
        const tools = vscode.lm.tools.filter(tool =>
            tool.name.startsWith('cogent_') &&
            (!useFullWorkspace || tool.name !== 'cogent_readFile')
        );

        const options: vscode.LanguageModelChatRequestOptions = {
            justification: 'To make a request to Cogent',
        };

        const result = await renderPrompt(
            ToolUserPrompt,
            {
                context: chatContext,
                request,
                toolCallRounds: [],
                toolCallResults: {}
            },
            { modelMaxPromptTokens: model.maxInputTokens },
            model
        );

        let messages = result.messages;
        result.references.forEach(ref => {
            if (ref.anchor instanceof vscode.Uri || ref.anchor instanceof vscode.Location) {
                stream.reference(ref.anchor);
            }
        });

        const toolReferences = [...request.toolReferences];
        const accumulatedToolResults: Record<string, vscode.LanguageModelToolResult> = {};
        const toolCallRounds: ToolCallRound[] = [];
        let hasFileUpdateCall = false;

        const runWithTools = async (): Promise<void> => {
            const requestedTool = toolReferences.shift();
            if (requestedTool) {
                options.toolMode = vscode.LanguageModelChatToolMode.Required;
                options.tools = vscode.lm.tools.filter(tool => tool.name === requestedTool.name);
            } else {
                options.toolMode = undefined;
                options.tools = [...tools];
            }

            const response = await model.sendRequest(messages, options, token);
            const toolCalls: vscode.LanguageModelToolCallPart[] = [];
            let responseStr = '';

            for await (const part of response.stream) {
                if (part instanceof vscode.LanguageModelTextPart) {
                    stream.markdown(part.value);
                    responseStr += part.value;
                } else if (part instanceof vscode.LanguageModelToolCallPart) {
                    if (part.name === 'cogent_updateFile' || part.name === 'cogent_applyDiff') {
                        hasFileUpdateCall = true;
                    }
                    toolCalls.push(part);
                }
            }

            if (toolCalls.length) {
                toolCallRounds.push({
                    response: responseStr,
                    toolCalls
                });

                const result = await renderPrompt(
                    ToolUserPrompt,
                    {
                        context: chatContext,
                        request,
                        toolCallRounds,
                        toolCallResults: accumulatedToolResults
                    },
                    { modelMaxPromptTokens: model.maxInputTokens },
                    model
                );

                messages = result.messages;
                const toolResultMetadata = result.metadatas.getAll(ToolResultMetadata);
                if (toolResultMetadata?.length) {
                    toolResultMetadata.forEach(meta => accumulatedToolResults[meta.toolCallId] = meta.result);
                }

                return runWithTools();
            }
        };

        await runWithTools();

        if (hasFileUpdateCall) {
            stream.button({
                command: 'cogent.applyChanges',
                title: vscode.l10n.t('Save All Changes')
            });
        }

        return {
            metadata: {
                toolCallsMetadata: {
                    toolCallResults: accumulatedToolResults,
                    toolCallRounds
                }
            } satisfies TsxToolUserMetadata,
        };
    };

    const toolUser = vscode.chat.createChatParticipant('cogent.assistant', handler);
    toolUser.iconPath = vscode.Uri.joinPath(context.extensionUri, 'assets/cogent.jpeg');

    // Register the apply changes command
    const applyChangesCommand = vscode.commands.registerCommand('cogent.applyChanges', async () => {
        await vscode.workspace.saveAll();
        vscode.window.showInformationMessage('All changes have been saved');
    });

    context.subscriptions.push(toolUser, applyChangesCommand);
}
