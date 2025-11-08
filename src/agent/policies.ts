import { PlanStep } from './plans';
import { getTool } from '../mcp/registry';

const DEFAULT_CONTEXT_TOKEN_THRESHOLD = 2000;
const DEFAULT_HOP_THRESHOLD = 6;

export function chooseExecMode(step: PlanStep, index: number): PlanStep {
    if (step.kind !== 'useTool') {
        return step;
    }

    const tool = getTool(step.tool);
    if (!tool) {
        return step;
    }

    const tokenHeavy = (step.tokenEstimate ?? 0) > DEFAULT_CONTEXT_TOKEN_THRESHOLD;
    const hopHeavy = index >= DEFAULT_HOP_THRESHOLD;

    if (tool.preferredMode === 'codeExec' || tokenHeavy || hopHeavy) {
        return {
            kind: 'execCode',
            language: 'node',
            code: `console.log(${JSON.stringify(
                `Tool ${tool.name} auto-converted to code execution with args ${JSON.stringify(step.args)}`
            )});`,
            saveAs: step.saveAs,
            tokenEstimate: step.tokenEstimate,
        };
    }

    return step;
}
