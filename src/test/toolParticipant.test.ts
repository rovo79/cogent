import * as vscode from 'vscode';
import { registerToolUserChatParticipant } from '../toolParticipant';
import { describe, it, expect, beforeEach } from '@jest/globals';

// Mock the vscode.lm namespace
jest.mock('vscode', () => ({
    ...jest.requireActual('vscode'),
    lm: {
        selectChatModels: jest.fn()
    }
}));

describe('registerToolUserChatParticipant', () => {
    let mockContext: vscode.ExtensionContext;
    let mockStream: vscode.ChatResponseStream;
    let mockToken: vscode.CancellationToken;

    beforeEach(() => {
        // Mock VSCode context
        mockContext = {
            subscriptions: []
        } as unknown as vscode.ExtensionContext;

        // Mock stream
        mockStream = {
            markdown: jest.fn(),
            append: jest.fn(),
            progress: jest.fn()
        } as unknown as vscode.ChatResponseStream;

        // Mock cancellation token
        mockToken = {
            isCancellationRequested: false
        } as vscode.CancellationToken;

        // Reset all mocks before each test
        jest.clearAllMocks();
    });

    it('should display available models', async () => {
        const mockModels = [
            {
                name: 'TestModel1',
                family: 'TestFamily1',
                maxInputTokens: 1000,
                vendor: 'TestVendor1'
            },
            {
                name: 'TestModel2',
                family: 'TestFamily2',
                maxInputTokens: 2000,
                vendor: 'TestVendor2'
            }
        ];

        // Setup the mock to return our test models
        (vscode.lm.selectChatModels as jest.Mock).mockResolvedValue(mockModels);

        // Get the handler function
        const participant = registerToolUserChatParticipant(mockContext);

        // Call the handler with mock request and context
        await participant({} as vscode.ChatRequest, {} as vscode.ChatContext, mockStream, mockToken);

        // Verify markdown calls
        expect(mockStream.markdown).toHaveBeenCalledWith('📋 Available Models:\n');
        expect(mockStream.markdown).toHaveBeenCalledWith(
            '- TestModel1\n  - Max tokens: 1000\n  - Vendor: TestVendor1\n'
        );
        expect(mockStream.markdown).toHaveBeenCalledWith(
            '- TestModel2\n  - Max tokens: 2000\n  - Vendor: TestVendor2\n'
        );
    });
});
