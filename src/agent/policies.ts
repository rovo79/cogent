import { PlanStep } from './plans';
import { getTool } from '../mcp/registry';

export function chooseExecMode(step: PlanStep): PlanStep {
    if (step.kind !== 'useTool') {
        return step;
    }

    const tool = getTool(step.tool);
    if (!tool) {
        return step;
    }

    if (tool.preferredMode === 'codeExec') {
        return {
            kind: 'execCode',
            language: 'node',
            code: `// TODO: implement code adapter for tool ${tool.name}`,
            saveAs: step.saveAs,
        };
    }

    return step;
}
