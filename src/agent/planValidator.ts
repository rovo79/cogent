import { Plan, PlanStep } from './plans';
import { getTool, listTools } from '../mcp/registry';
import { ToolParam, ToolRisk } from '../mcp/types';

export interface PlanValidationOptions {
    maxSteps: number;
    maxTokenBudget: number;
    allowedTools?: string[];
    approvalRequiredFor?: ToolRisk[];
}

export class PlanValidationError extends Error {
    constructor(message: string, public readonly stepIndex?: number) {
        super(message);
        this.name = 'PlanValidationError';
    }
}

const DEFAULT_APPROVAL_RISKS: ToolRisk[] = ['write', 'exec', 'net'];

function needsApproval(risk: ToolRisk, options: PlanValidationOptions): boolean {
    const approvalSet = new Set(options.approvalRequiredFor ?? DEFAULT_APPROVAL_RISKS);
    return approvalSet.has(risk);
}

function assertAllowedTool(toolName: string, options: PlanValidationOptions, stepIndex: number) {
    const tool = getTool(toolName);
    if (!tool) {
        const available = listTools().map((t) => t.name).join(', ');
        throw new PlanValidationError(`Unknown tool '${toolName}'. Available tools: ${available}`, stepIndex);
    }
    if (options.allowedTools && !options.allowedTools.includes(toolName)) {
        throw new PlanValidationError(`Tool '${toolName}' is not permitted for this run`, stepIndex);
    }
}

function validateArgsAgainstSchema(args: Record<string, unknown>, schema: ToolParam[], stepIndex: number) {
    const required = schema.filter((param) => param.required).map((param) => param.name);
    for (const paramName of required) {
        if (!(paramName in args)) {
            throw new PlanValidationError(`Missing required argument '${paramName}'`, stepIndex);
        }
    }

    const allowedKeys = new Set(schema.map((param) => param.name));
    for (const key of Object.keys(args)) {
        if (!allowedKeys.has(key)) {
            throw new PlanValidationError(`Unexpected argument '${key}'`, stepIndex);
        }
    }
}

function accumulateTokens(total: number, step: PlanStep, max: number, index: number): number {
    const estimate = step.tokenEstimate ?? 0;
    const nextTotal = total + estimate;
    if (nextTotal > max) {
        throw new PlanValidationError(`Token budget exceeded at step ${index + 1} (limit ${max})`, index);
    }
    return nextTotal;
}

export function validatePlan(plan: Plan, options: PlanValidationOptions): void {
    if (plan.steps.length > options.maxSteps) {
        throw new PlanValidationError(
            `Plan has ${plan.steps.length} steps which exceeds the limit of ${options.maxSteps}`
        );
    }

    let cumulativeTokens = 0;
    let approvalAvailable = false;

    plan.steps.forEach((step, index) => {
        cumulativeTokens = accumulateTokens(cumulativeTokens, step, options.maxTokenBudget, index);

        switch (step.kind) {
            case 'useTool': {
                assertAllowedTool(step.tool, options, index);
                const tool = getTool(step.tool);
                if (!tool) {
                    throw new PlanValidationError(`Tool '${step.tool}' was removed before execution`, index);
                }
                validateArgsAgainstSchema(step.args, tool.io.params, index);
                if (needsApproval(tool.risk, options)) {
                    if (!approvalAvailable) {
                        throw new PlanValidationError(
                            `Tool '${tool.name}' with risk '${tool.risk}' requires prior approval`,
                            index
                        );
                    }
                    approvalAvailable = false;
                }
                break;
            }
            case 'execCode': {
                if (needsApproval('exec', options)) {
                    if (!approvalAvailable) {
                        throw new PlanValidationError('Code execution requires prior approval', index);
                    }
                    approvalAvailable = false;
                }
                break;
            }
            case 'askApproval': {
                approvalAvailable = true;
                break;
            }
            case 'summarize': {
                // summarization steps reset approval availability so new writes need fresh confirmation
                approvalAvailable = false;
                break;
            }
            default: {
                const exhaustiveCheck: never = step;
                return exhaustiveCheck;
            }
        }
    });

    if (approvalAvailable) {
        // Having a dangling approval step is suspicious, fail closed so a rogue plan cannot skip execution.
        throw new PlanValidationError('Plan ends with unused approval. Refusing to execute.');
    }
}
