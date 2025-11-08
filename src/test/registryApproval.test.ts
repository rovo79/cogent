import { strict as assert } from 'assert';
import { validatePlan, PlanValidationError } from '../agent/planValidator';
import { Plan } from '../agent/plans';
import { resetRegistry, registerTool } from '../mcp/registry';
import { prepareHotspotDiffTool, applyHotspotPatchTool } from '../mcp/tools/demoHotspots';

describe('Registry approval enforcement', () => {
    beforeEach(() => {
        resetRegistry();
        registerTool(prepareHotspotDiffTool);
        registerTool(applyHotspotPatchTool);
    });

    it('requires approval for write-risk tools', () => {
        const plan: Plan = {
            goal: 'demo',
            rationale: 'missing approval',
            steps: [
                { kind: 'useTool', tool: 'prepare_hotspot_diff', args: { path: 'assets/hotspots-demo.txt' }, tokenEstimate: 10 },
                { kind: 'useTool', tool: 'apply_hotspot_patch', args: { patch: { $slot: 'patch' } }, tokenEstimate: 5 },
            ],
        };

        assert.throws(
            () =>
                validatePlan(plan, {
                    maxSteps: 5,
                    maxTokenBudget: 100,
                    allowedTools: ['prepare_hotspot_diff', 'apply_hotspot_patch'],
                }),
            PlanValidationError
        );
    });

    it('passes when approval precedes write tool', () => {
        const plan: Plan = {
            goal: 'demo',
            rationale: 'with approval',
            steps: [
                { kind: 'useTool', tool: 'prepare_hotspot_diff', args: { path: 'assets/hotspots-demo.txt' }, saveAs: 'patch', tokenEstimate: 10 },
                { kind: 'askApproval', reason: 'apply patch', previewSlot: 'patch', tokenEstimate: 1 },
                { kind: 'useTool', tool: 'apply_hotspot_patch', args: { patch: { $slot: 'patch' } }, tokenEstimate: 5 },
            ],
        };

        assert.doesNotThrow(() =>
            validatePlan(plan, {
                maxSteps: 5,
                maxTokenBudget: 100,
                allowedTools: ['prepare_hotspot_diff', 'apply_hotspot_patch'],
            })
        );
    });
});
