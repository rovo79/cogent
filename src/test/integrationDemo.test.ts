import { strict as assert } from 'assert';
import { Plan } from '../agent/plans';
import { runPlan, ExecContext } from '../agent/execution/execManager';
import { registerTool, resetRegistry } from '../mcp/registry';
import { Tool } from '../mcp/types';

describe('Demo integration plan', () => {
    beforeEach(() => {
        resetRegistry();
    });

    it('stops execution when approval is denied for writes', async () => {
        let readInvoked = false;
        let writeInvoked = false;

        const readTool: Tool = {
            name: 'integration_read',
            description: 'read',
            io: { params: [], returns: 'string' },
            risk: 'read',
            preferredMode: 'MCP',
            async run() {
                readInvoked = true;
                return 'contents';
            },
        };

        const writeTool: Tool = {
            name: 'integration_write',
            description: 'write',
            io: { params: [{ name: 'value', type: 'string', required: true }], returns: 'void' },
            risk: 'write',
            preferredMode: 'MCP',
            async run() {
                writeInvoked = true;
                return undefined;
            },
        };

        registerTool(readTool);
        registerTool(writeTool);

        const plan: Plan = {
            goal: 'demo',
            rationale: 'integration test',
            steps: [
                { kind: 'useTool', tool: 'integration_read', args: {}, saveAs: 'data', tokenEstimate: 10 },
                { kind: 'askApproval', reason: 'allow write', previewSlot: 'data', tokenEstimate: 1 },
                { kind: 'useTool', tool: 'integration_write', args: { value: { $slot: 'data' } }, tokenEstimate: 5 },
                { kind: 'summarize', inputs: ['data'], tokenEstimate: 2 },
            ],
        };

        const ctx: ExecContext = {
            cwd: process.cwd(),
            env: {},
            approval: async () => false,
            writeUserMessage: () => {
                /* noop for test */
            },
            slots: new Map(),
        };

        await assert.rejects(runPlan(plan, ctx), /User rejected operation/);
        assert.ok(readInvoked, 'read tool should be invoked before approval');
        assert.ok(!writeInvoked, 'write tool should not run when approval is rejected');
    });
});
