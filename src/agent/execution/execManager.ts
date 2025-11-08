import { Plan, PlanStep } from '../plans';
import { getTool, toolRequiresApproval } from '../../mcp/registry';
import { runInNodeSandbox } from './sandboxes/nodeSandbox';
import { recordAudit } from '../../telemetry/audit';
import { ToolRisk } from '../../mcp/types';

export interface ApprovalRequest {
    reason: string;
    preview?: string;
    risk: ToolRisk | 'plan';
    toolName?: string;
}

export type ApprovalHandler = (request: ApprovalRequest) => Promise<boolean>;

export interface ExecutionPolicies {
    autoApproveTools: Set<string>;
    allowRisks: Partial<Record<ToolRisk, boolean>>;
    sandbox: {
        timeoutMs: number;
        memoryLimitMb: number;
        allowedModules: string[];
        maxOutputBytes: number;
    };
}

export type ExecEvent =
    | { type: 'plan-started'; plan: Plan }
    | { type: 'plan-completed'; plan: Plan }
    | { type: 'step-started'; index: number; step: PlanStep }
    | { type: 'step-completed'; index: number; step: PlanStep; resultSummary: string }
    | { type: 'step-failed'; index: number; step: PlanStep; error: string }
    | { type: 'approval-requested'; request: ApprovalRequest };

export interface ExecContext {
    cwd: string;
    env: Record<string, string>;
    approval: ApprovalHandler;
    writeUserMessage: (msg: string) => void;
    slots: Map<string, unknown>;
    policies: ExecutionPolicies;
    onEvent?: (event: ExecEvent) => void;
}

export async function runPlan(plan: Plan, ctx: ExecContext): Promise<void> {
    ctx.onEvent?.({ type: 'plan-started', plan });
    ctx.writeUserMessage(`Plan rationale: ${plan.rationale}`);
    await recordAudit({ type: 'plan_started', goal: plan.goal, rationale: plan.rationale });

    for (const [index, step] of plan.steps.entries()) {
        ctx.onEvent?.({ type: 'step-started', index, step });
        try {
            const result = await runStep(step, ctx, index);
            if ('saveAs' in step && step.saveAs) {
                ctx.slots.set(step.saveAs, result);
            }
            ctx.onEvent?.({
                type: 'step-completed',
                index,
                step,
                resultSummary: summarizeResult(result),
            });
        } catch (error) {
            const message = error instanceof Error ? error.message : String(error);
            ctx.onEvent?.({ type: 'step-failed', index, step, error: message });
            await recordAudit({ type: 'plan_step_failed', stepIndex: index, message });
            throw error;
        }
    }

    ctx.onEvent?.({ type: 'plan-completed', plan });
    await recordAudit({ type: 'plan_completed', goal: plan.goal });
}

async function runStep(step: PlanStep, ctx: ExecContext, index: number): Promise<unknown> {
    switch (step.kind) {
        case 'useTool': {
            const tool = getTool(step.tool);
            if (!tool) {
                throw new Error(`Tool not found: ${step.tool}`);
            }

            if (tool.risk === 'net' && ctx.policies.allowRisks.net !== true) {
                throw new Error(`Tool ${tool.name} requires network access which is disabled`);
            }

            const riskAllowed = ctx.policies.allowRisks[tool.risk] === true;
            if ((toolRequiresApproval(tool) && !riskAllowed) && !ctx.policies.autoApproveTools.has(tool.name)) {
                const preview = tool.getApprovalPreview ? await tool.getApprovalPreview(step.args) : JSON.stringify(step.args);
                await ensureApproval(ctx, {
                    reason: `Run tool ${tool.name}`,
                    preview,
                    risk: tool.risk,
                    toolName: tool.name,
                });
            }

            ctx.writeUserMessage(`[${tool.risk.toUpperCase()}] Executing tool ${tool.name}`);
            await recordAudit({ type: 'tool_call', tool: tool.name, args: step.args, stepIndex: index });
            return tool.run(step.args, {
                cwd: ctx.cwd,
                env: ctx.env,
                writeUserMessage: ctx.writeUserMessage,
            });
        }
        case 'execCode': {
            if (ctx.policies.allowRisks.exec !== true) {
                await ensureApproval(ctx, {
                    reason: 'Execute Node.js snippet in sandbox',
                    preview: truncate(step.code, 400),
                    risk: 'exec',
                });
            }
            await recordAudit({ type: 'code_exec', lang: step.language, stepIndex: index });
            if (step.language === 'node') {
                return runInNodeSandbox({
                    code: step.code,
                    cwd: ctx.cwd,
                    env: ctx.env,
                    timeoutMs: ctx.policies.sandbox.timeoutMs,
                    memoryLimitMb: ctx.policies.sandbox.memoryLimitMb,
                    allowedModules: ctx.policies.sandbox.allowedModules,
                    maxOutputBytes: ctx.policies.sandbox.maxOutputBytes,
                });
            }
            throw new Error(`Unsupported language ${step.language}`);
        }
        case 'askApproval': {
            await ensureApproval(ctx, {
                reason: step.reason,
                preview: undefined,
                risk: step.risk ?? 'exec',
            });
            return true;
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

async function ensureApproval(ctx: ExecContext, request: ApprovalRequest): Promise<void> {
    ctx.onEvent?.({ type: 'approval-requested', request });
    const approved = await ctx.approval(request);
    await recordAudit({
        type: 'approval',
        approved,
        reason: request.reason,
        risk: request.risk,
        tool: request.toolName,
    });
    if (!approved) {
        throw new Error('User rejected operation');
    }
}

function truncate(value: string, maxLength: number): string {
    if (value.length <= maxLength) {
        return value;
    }
    return `${value.slice(0, maxLength)}…`;
}

function summarizeResult(result: unknown): string {
    if (result === null || result === undefined) {
        return 'no result';
    }
    if (typeof result === 'string') {
        return truncate(result, 500);
    }
    try {
        return truncate(JSON.stringify(result), 500);
    } catch {
        return 'unserializable result';
    }
}
