import { makePlan } from './planner';
import { runPlan } from './execution/execManager';
import { buildContextSummary } from './context';
import { askApproval } from '../ui/approvals';

export interface AgentOptions {
    cwd: string;
    llm: (prompt: string) => Promise<string>;
    writeUserMessage: (message: string) => void;
}

export async function runAgent(goal: string, options: AgentOptions): Promise<void> {
    const context = await buildContextSummary(options.cwd);
    const plan = await makePlan({
        goal,
        contextSummary: JSON.stringify(context).slice(0, 4000),
        llm: options.llm,
    });

    await runPlan(plan, {
        cwd: options.cwd,
        env: {},
        approval: askApproval,
        writeUserMessage: options.writeUserMessage,
        slots: new Map<string, unknown>(),
    });
}
