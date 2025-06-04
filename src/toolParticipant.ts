import { renderPrompt } from '@vscode/prompt-tsx';
import * as vscode from 'vscode';
import { ToolCallRound, ToolResultMetadata, ToolUserPrompt } from './toolsPrompt';
import { Logger } from './components/Logger';

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
    const logger = Logger.getInstance();
    logger.info('🔵 Tool participant registration starting...');
    logger.info(`🔵 Chat API available: ${!!vscode.chat}`);
    logger.info(`🔵 Context subscriptions count: ${context.subscriptions.length}`);

    // Get debug configuration
    const debugMode = vscode.workspace.getConfiguration('cogent').get('debugMode', false);

    const handler: vscode.ChatRequestHandler = async (request: vscode.ChatRequest, chatContext: vscode.ChatContext, stream: vscode.ChatResponseStream, token: vscode.CancellationToken) => {
        // Only show debug info if debugMode is enabled
        if (debugMode) {
            stream.markdown('🔍 Debug: Initializing chat handler...');
            stream.markdown(`🔍 vscode.lm available: ${!!vscode.lm}`);
            stream.markdown('🔵 Chat request handler invoked');
            stream.markdown(`🔵 vscode.lm tools available: ${!!vscode.lm?.tools}`);
        }

        // Try to select the best available model
        let model: vscode.LanguageModelChat | undefined;
        const preferredModels = [
            { vendor: 'copilot', family: 'gpt-4.1' },
            { vendor: 'copilot', family: 'gpt-4o' },
            { vendor: 'copilot', family: 'gpt-4-turbo' },
            { vendor: 'copilot', family: 'claude-3.5-sonnet' },
            { vendor: 'copilot', family: 'o4-mini' },
            { vendor: 'copilot', family: 'gemini-2.0-flash' },
            { vendor: 'copilot', family: 'o3-mini' },
            { vendor: 'copilot', family: 'o1' },
            { vendor: 'copilot' },
            {}  // Empty object as fallback to get any available model
        ];

        try {
            // Try each preferred model in order
            for (const modelPreference of preferredModels) {
                try {
                    const models = await vscode.lm.selectChatModels(modelPreference);
                    if (models && models.length > 0) {
                        model = models[0];
                        stream.markdown(`🤖 Selected model:\n- Model: ${model.name || model.family}\n- Max tokens: ${model.maxInputTokens}\n- Vendor: ${model.vendor}`);
                        break;
                    }
                } catch (err) {
                    if (debugMode) {
                        stream.markdown(`🔍 Debug: Failed to select model with preference ${JSON.stringify(modelPreference)}: ${err instanceof Error ? err.message : String(err)}`);
                    }
                    // Continue to next model preference
                }
            }

            if (!model) {
                stream.markdown("❌ No suitable models found. Cogent requires access to language models like Claude or GPT to function.");
                return;
            }

            // NOW test model compatibility AFTER model is selected
            // Add a simple direct request first to check model compatibility
            try {
                if (debugMode) {
                    stream.markdown(`🔬 Testing basic model compatibility...`);
                }

                // Now model is guaranteed to be defined
                const testResponse = await model.sendRequest([
                    {
                        role: vscode.LanguageModelChatMessageRole.User,
                        content: [new vscode.LanguageModelTextPart("Hello, are you working?")],
                        name: "user" // Adding the required name property
                    }
                ], {}, token);

                // If we get here, the basic model works
                if (debugMode) {
                    stream.markdown(`✅ Basic model compatibility test passed`);
                }
            } catch (error) {
                // The model isn't working even for basic requests
                const errorMessage = error instanceof Error ? error.message : String(error);
                stream.markdown(`⚠️ Model compatibility test failed: ${errorMessage}`);
            }

            // Remove the duplicate model selection code further down

            // Rest of your handler code...
        } catch (error) {
            const errorMessage = error instanceof Error ? error.message : String(error);
            stream.markdown(`⚠️ Error selecting model: ${errorMessage}`);
            return;
        }

        // First, check available models
        try {
            if (debugMode) {
                stream.markdown('🔵 Checking available models...');
            }
            const allModels = await vscode.lm.selectChatModels({});

            // Debug log to see allModels content
            if (debugMode) {
                stream.markdown(`🔵 Available models: ${JSON.stringify(allModels, null, 2)}`);

                if (allModels && allModels.length > 0) {
                    stream.markdown(`🔵 Found ${allModels.length} models`);
                    // Stream the header first
                    await stream.markdown(`📋 Available Models:`);

                    // Stream each model info individually
                    for (const m of allModels) {
                        await stream.markdown(`- ${m.name || m.family}\n` +
                                         `  - Max tokens: ${m.maxInputTokens}\n` +
                                         `  - Vendor: ${m.vendor}`);
                        // Add a small delay to ensure proper streaming order
                        await new Promise(resolve => setTimeout(resolve, 50));
                    }
                }
            }
        } catch (error: unknown) {
            const errorMessage = error instanceof Error ? error : String(error);
            logger.error("⚠️ Error checking available models");
            logger.error(errorMessage);
            if (debugMode) {
                stream.markdown("⚠️ Error checking available models");
            }
        }

        // Show available tools
        if (debugMode) {
            stream.markdown(`\n🛠️ Available Tools:\n`);
            vscode.lm.tools.forEach(tool => {
                stream.markdown(`- ${tool.name}\n` +
                              `  - Description: ${tool.description}\n` +
                              `  - Input Schema: ${JSON.stringify(tool.inputSchema, null, 2)}\n`);
            });
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
