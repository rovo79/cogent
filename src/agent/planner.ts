import { Plan } from './plans';
import { listTools } from '../mcp/registry';
import { chooseExecMode } from './policies';

export interface PlannerOptions {
    goal: string;
    contextSummary: string;
    llm: (prompt: string) => Promise<string>;
}

export async function makePlan(opts: PlannerOptions): Promise<Plan> {
    const toolsBrief = listTools()
        .map((tool) => `- ${tool.name}: ${tool.description}`)
        .join('\n');

    const prompt = `\nGoal:\n${opts.goal}\n\nContext:\n${opts.contextSummary}\n\nAvailable tools:\n${toolsBrief}\n\nRules:\n1) Prefer code execution for multi-file analysis or long pipelines.\n2) Use a maximum of 3 tool calls before summarizing results.\n3) Ask for approval before making workspace edits or running destructive commands.\n\nReturn JSON with fields: goal, rationale, steps[]. Steps may be "useTool" or "execCode" etc.\n`.trim();

    const rawPlan = await opts.llm(prompt);

    let plan: Plan;
    try {
        plan = JSON.parse(rawPlan) as Plan;
    } catch (error) {
        throw new Error(`Failed to parse plan JSON: ${(error as Error).message}`);
    }

    plan.steps = plan.steps.map((step, index) => chooseExecMode(step, index));
    return plan;
}
