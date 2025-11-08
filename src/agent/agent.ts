import { makePlan } from './planner';
import { runPlan, ExecutionPolicies, ExecEvent, ApprovalHandler } from './execution/execManager';
import { buildContextSummary, ContextSummaryOptions } from './context';

export interface AgentOptions {
    cwd: string;
    llm: (prompt: string) => Promise<string>;
    writeUserMessage: (message: string) => void;
    approval: ApprovalHandler;
    policies: ExecutionPolicies;
    contextOptions?: ContextSummaryOptions;
    onEvent?: (event: ExecEvent) => void;
}

export async function runAgent(goal: string, options: AgentOptions): Promise<void> {
    const context = await buildContextSummary(options.cwd, options.contextOptions);
    const plan = await makePlan({
        goal,
        contextSummary: JSON.stringify(context).slice(0, 4000),
        llm: options.llm,
    });

    await runPlan(plan, {
        cwd: options.cwd,
        env: {},
        approval: options.approval,
        writeUserMessage: options.writeUserMessage,
        slots: new Map<string, unknown>(),
        policies: {
            autoApproveTools: options.policies.autoApproveTools,
            allowRisks: options.policies.allowRisks,
            sandbox: options.policies.sandbox,
        },
        onEvent: options.onEvent,
    });
}
