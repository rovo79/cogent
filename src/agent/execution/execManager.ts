import { Plan, PlanStep } from '../plans';
import { getTool } from '../../mcp/registry';
import { runInNodeSandbox } from './sandboxes/nodeSandbox';
import { recordAudit } from '../../telemetry/audit';

export interface ExecContext {
    cwd: string;
    env: Record<string, string>;
    approval: (reason: string, preview?: string) => Promise<boolean>;
    writeUserMessage: (msg: string) => void;
    slots: Map<string, unknown>;
}

export async function runPlan(plan: Plan, ctx: ExecContext): Promise<void> {
    ctx.writeUserMessage(`Plan rationale: ${plan.rationale}`);
    for (const step of plan.steps) {
        const result = await runStep(step, ctx);
        if ('saveAs' in step && step.saveAs) {
            ctx.slots.set(step.saveAs, result);
        }
    }
}

async function runStep(step: PlanStep, ctx: ExecContext): Promise<unknown> {
    switch (step.kind) {
        case 'useTool': {
            const tool = getTool(step.tool);
            if (!tool) {
                throw new Error(`Tool not found: ${step.tool}`);
            }
            await recordAudit({ type: 'tool_call', tool: tool.name, args: step.args });
            return tool.run(step.args, {
                cwd: ctx.cwd,
                env: ctx.env,
                writeUserMessage: ctx.writeUserMessage,
            });
        }
        case 'execCode': {
            await recordAudit({ type: 'code_exec', lang: step.language });
            if (step.language === 'node') {
                return runInNodeSandbox({ code: step.code, cwd: ctx.cwd, env: ctx.env });
            }
            throw new Error(`Unsupported language ${step.language}`);
        }
        case 'askApproval': {
            const approved = await ctx.approval(step.reason);
            if (!approved) {
                throw new Error('User rejected operation');
            }
            return approved;
        }
        case 'summarize': {
            ctx.writeUserMessage('Summaries are not yet implemented.');
            return undefined;
        }
        default: {
            const exhaustiveCheck: never = step;
            return exhaustiveCheck;
        }
    }
}
