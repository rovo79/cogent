import { strict as assert } from 'assert';
import { validatePlan, PlanValidationError } from '../agent/planValidator';
import { Plan } from '../agent/plans';
import { registerTool, resetRegistry } from '../mcp/registry';
import { Tool } from '../mcp/types';

describe('Plan validator', () => {
    const readTool: Tool = {
        name: 'test_read',
        description: 'read',
        io: { params: [], returns: 'string' },
        risk: 'read',
        preferredMode: 'MCP',
        async run() {
            return 'ok';
        },
    };

    const writeTool: Tool = {
        name: 'test_write',
        description: 'write',
        io: { params: [], returns: 'void' },
        risk: 'write',
        preferredMode: 'MCP',
        async run() {
            return 'ok';
        },
    };

    beforeEach(() => {
        resetRegistry();
        registerTool(readTool);
        registerTool(writeTool);
    });

    it('accepts a valid plan with approvals', () => {
        const plan: Plan = {
            goal: 'demo',
            rationale: 'valid',
            steps: [
                { kind: 'useTool', tool: 'test_read', args: {}, tokenEstimate: 10 },
                { kind: 'askApproval', reason: 'write?', tokenEstimate: 2 },
                { kind: 'useTool', tool: 'test_write', args: {}, tokenEstimate: 5 },
            ],
        };

        assert.doesNotThrow(() =>
            validatePlan(plan, { maxSteps: 5, maxTokenBudget: 50, allowedTools: ['test_read', 'test_write'] })
        );
    });

    it('rejects write steps without prior approval', () => {
        const plan: Plan = {
            goal: 'demo',
            rationale: 'invalid',
            steps: [{ kind: 'useTool', tool: 'test_write', args: {}, tokenEstimate: 5 }],
        };

        assert.throws(
            () => validatePlan(plan, { maxSteps: 5, maxTokenBudget: 50 }),
            PlanValidationError
        );
    });

    it('enforces token budgets', () => {
        const plan: Plan = {
            goal: 'demo',
            rationale: 'too big',
            steps: [
                { kind: 'askApproval', reason: 'approve', tokenEstimate: 2 },
                { kind: 'useTool', tool: 'test_write', args: {}, tokenEstimate: 100 },
            ],
        };

        assert.throws(
            () => validatePlan(plan, { maxSteps: 5, maxTokenBudget: 20, allowedTools: ['test_write'] }),
            PlanValidationError
        );
    });
});
