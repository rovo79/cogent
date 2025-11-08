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

// Helper to truncate context summary at a valid JSON boundary (removes file entries)
function truncateContextSummary(context: any, maxLength: number): string {
    // If context has a 'files' array, remove files from the end until under maxLength
    if (context && Array.isArray(context.files)) {
        let files = [...context.files];
        let truncatedContext = { ...context, files };
        let json = JSON.stringify(truncatedContext);
        while (json.length > maxLength && files.length > 0) {
            files.pop();
            truncatedContext = { ...context, files };
            json = JSON.stringify(truncatedContext);
        }
        return json.length > maxLength ? json.slice(0, maxLength) : json;
    }
    // Fallback: just slice, but this is less safe
    const json = JSON.stringify(context);
    return json.length > maxLength ? json.slice(0, maxLength) : json;
}

export async function runAgent(goal: string, options: AgentOptions): Promise<void> {
    const context = await buildContextSummary(options.cwd, options.contextOptions);
    const plan = await makePlan({
        goal,
        contextSummary: truncateContextSummary(context, 4000),
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
