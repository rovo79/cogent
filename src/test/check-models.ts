import * as vscode from 'vscode';

export async function checkAvailableModels() {
    const output = vscode.window.createOutputChannel("Model Checker");
    output.show();

    output.appendLine(`=== VS Code Model Compatibility Check ===`);
    output.appendLine(`Time: ${new Date().toISOString()}`);
    output.appendLine(`vscode.lm available: ${!!vscode.lm}`);

    if (!vscode.lm) {
        output.appendLine("Language Model API not available!");
        return;
    }

    try {
        // Test 1: List all available models
        output.appendLine("\n=== Available Models ===");
        const allModels = await vscode.lm.selectChatModels({});

        if (!allModels || allModels.length === 0) {
            output.appendLine("No models found!");
            return;
        }

        output.appendLine(`Found ${allModels.length} models:`);

        // Test 2: Try each model with simple requests
        for (const model of allModels) {
            output.appendLine(`\n🔍 Testing model: ${model.name || model.family} (${model.vendor})`);
            output.appendLine(`  Max tokens: ${model.maxInputTokens}`);

            try {
                // Test 2a: Very simple "Hello" request
                output.appendLine("  Test 1: Simple text request");
                const simpleResponse = await model.sendRequest([
                    {
                        role: vscode.LanguageModelChatMessageRole.User,
                        content: [new vscode.LanguageModelTextPart("Hello, are you working?")],
                        name: "user"
                    }
                ], {}, new vscode.CancellationTokenSource().token);

                // Consume the stream
                let responseText = "";
                for await (const part of simpleResponse.stream) {
                    if (part instanceof vscode.LanguageModelTextPart) {
                        responseText += part.value;
                    }
                }
                output.appendLine(`  ✅ Simple request successful (${responseText.length} chars)`);

                // Test 2b: Request with instruction instead of system message
                // VS Code API doesn't have a System role, using User with clear instruction
                output.appendLine("  Test 2: Request with instruction");
                const instructionResponse = await model.sendRequest([
                    {
                        role: vscode.LanguageModelChatMessageRole.User,
                        content: [new vscode.LanguageModelTextPart("You are a helpful assistant. Explain what you can do in one sentence.")],
                        name: "user"
                    }
                ], {}, new vscode.CancellationTokenSource().token);

                // Consume the stream
                responseText = "";
                for await (const part of instructionResponse.stream) {
                    if (part instanceof vscode.LanguageModelTextPart) {
                        responseText += part.value;
                    }
                }
                output.appendLine(`  ✅ Instruction request successful (${responseText.length} chars)`);

                // Test 2c: Request with tools
                output.appendLine("  Test 3: Request with tools available");
                const toolsResponse = await model.sendRequest([
                    {
                        role: vscode.LanguageModelChatMessageRole.User,
                        content: [new vscode.LanguageModelTextPart("Hello, can you help me with file operations?")],
                        name: "user"
                    }
                ], {
                    tools: [...vscode.lm.tools],
                    toolMode: vscode.LanguageModelChatToolMode.Auto
                }, new vscode.CancellationTokenSource().token);

                // Consume the stream
                responseText = "";
                for await (const part of toolsResponse.stream) {
                    if (part instanceof vscode.LanguageModelTextPart) {
                        responseText += part.value;
                    }
                }
                output.appendLine(`  ✅ Tools request successful (${responseText.length} chars)`);

                output.appendLine(`  ✅ All tests passed for ${model.name || model.family}`);
            } catch (error) {
                const errorMessage = error instanceof Error ? error.message : String(error);
                const errorObj = tryParseJson(errorMessage);
                output.appendLine(`  ❌ Model test failed: ${JSON.stringify(errorObj || errorMessage)}`);
            }
        }
    } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        output.appendLine(`Error during model check: ${errorMessage}`);
    }

    output.appendLine("\n=== Check Complete ===");
}

function tryParseJson(str: string): any {
    try {
        return JSON.parse(str);
    } catch (e) {
        return null;
    }
}

// For direct testing
export async function checkModels() {
    try {
        const allModels = await vscode.lm.selectChatModels({});
        console.log('\nAvailable Language Models:');
        console.log('------------------------');

        if (allModels && allModels.length > 0) {
            allModels.forEach(model => {
                console.log(`\nModel: ${model.name || model.family}`);
                console.log(`Vendor: ${model.vendor}`);
                console.log(`Max Input Tokens: ${model.maxInputTokens}`);
                console.log('------------------------');
            });
        } else {
            console.log('No language models found');
        }
    } catch (error) {
        console.error('Error checking models:', error);
    }
}
