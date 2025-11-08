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

function resolveValue(value: unknown, slots: Map<string, unknown>): unknown {
    if (Array.isArray(value)) {
        return value.map((entry) => resolveValue(entry, slots));
    }

    if (value && typeof value === 'object') {
        const candidate = value as Record<string, unknown>;
        if ('$slot' in candidate) {
            const slotName = String(candidate.$slot);
            if (!slots.has(slotName)) {
                throw new Error(`Slot '${slotName}' is not defined`);
            }
            const slotValue = slots.get(slotName);
            if (candidate.field) {
                const fieldName = String(candidate.field);
                if (slotValue && typeof slotValue === 'object' && fieldName in slotValue) {
                    return (slotValue as Record<string, unknown>)[fieldName];
                }
                throw new Error(`Slot '${slotName}' does not contain field '${fieldName}'`);
            }
            return slotValue;
        }

        return Object.fromEntries(
            Object.entries(candidate).map(([key, val]) => [key, resolveValue(val, slots)])
        );
    }

    return value;
}

function resolveArgs(args: Record<string, unknown>, slots: Map<string, unknown>): Record<string, unknown> {
    return Object.fromEntries(Object.entries(args).map(([key, value]) => [key, resolveValue(value, slots)]));
}

function extractPreviewFromSlot(slots: Map<string, unknown>, slot?: string): string | undefined {
    if (!slot) {
        return undefined;
    }
    if (!slots.has(slot)) {
        return undefined;
    }
    const payload = slots.get(slot);
    if (typeof payload === 'string') {
        return payload;
    }
    if (payload && typeof payload === 'object') {
        if ('diff' in (payload as Record<string, unknown>)) {
            return String((payload as Record<string, unknown>).diff);
        }
        return JSON.stringify(payload, null, 2);
    }
    return String(payload);
}

export async function runPlan(plan: Plan, ctx: ExecContext): Promise<void> {
    ctx.writeUserMessage(`Plan rationale: ${plan.rationale}`);
    const startedAt = Date.now();
    let toolSteps = 0;
    let codeSteps = 0;
    let totalTokens = 0;

    for (let index = 0; index < plan.steps.length; index++) {
        const step = plan.steps[index];
        const stepStart = Date.now();
        const result = await runStep(step, ctx);
        if ('saveAs' in step && step.saveAs) {
            ctx.slots.set(step.saveAs, result);
        }
        const duration = Date.now() - stepStart;
        totalTokens += step.tokenEstimate ?? 0;
        if (step.kind === 'useTool') {
            toolSteps++;
        } else if (step.kind === 'execCode') {
            codeSteps++;
        }
        await recordAudit({
            type: 'plan_step',
            index,
            kind: step.kind,
            durationMs: duration,
            tokens: step.tokenEstimate ?? 0,
            tool: step.kind === 'useTool' ? step.tool : undefined,
        });
    }

    const elapsed = Date.now() - startedAt;
    ctx.writeUserMessage(
        `Run summary: ${plan.steps.length} steps (${toolSteps} tool / ${codeSteps} code), token estimate ${totalTokens}, wall time ${elapsed}ms.`
    );
}

async function runStep(step: PlanStep, ctx: ExecContext): Promise<unknown> {
    switch (step.kind) {
        case 'useTool': {
            const tool = getTool(step.tool);
            if (!tool) {
                throw new Error(`Tool not found: ${step.tool}`);
            }
            const resolvedArgs = resolveArgs(step.args, ctx.slots);
            await recordAudit({ type: 'tool_call', tool: tool.name, args: resolvedArgs });
            return tool.run(resolvedArgs, {
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
            const preview = extractPreviewFromSlot(ctx.slots, step.previewSlot);
            const approved = await ctx.approval(step.reason, preview);
            if (!approved) {
                throw new Error('User rejected operation');
            }
            return approved;
        }
        case 'summarize': {
            const summaryParts = step.inputs.map((input, idx) => {
                if (!ctx.slots.has(input)) {
                    return `Input ${idx + 1} (${input}) missing`;
                }
                const value = ctx.slots.get(input);
                if (typeof value === 'string') {
                    return value;
                }
                return JSON.stringify(value, null, 2);
            });
            const message = `Summary:\n${summaryParts.join('\n')}`;
            ctx.writeUserMessage(message);
            return message;
        }
        default: {
            const exhaustiveCheck: never = step;
            return exhaustiveCheck;
        }
    }
}
