import { getTool } from '../mcp/registry';
import { ToolRisk } from '../mcp/types';

export type PlanStep =
    | {
          kind: 'useTool';
          tool: string;
          args: Record<string, unknown>;
          saveAs?: string;
      }
    | {
          kind: 'execCode';
          language: 'node' | 'shell';
          code: string;
          saveAs?: string;
      }
    | {
          kind: 'askApproval';
          reason: string;
          risk?: ToolRisk;
      }
    | {
          kind: 'summarize';
          inputs: string[];
          saveAs?: string;
      };

export interface Plan {
    goal: string;
    rationale: string;
    steps: PlanStep[];
}

export class PlanValidationError extends Error {
    constructor(message: string) {
        super(message);
        this.name = 'PlanValidationError';
    }
}

const MAX_STEPS = 12;

export function validatePlan(plan: Plan): Plan {
    if (!plan || typeof plan !== 'object') {
        throw new PlanValidationError('Plan must be an object');
    }
    if (typeof plan.goal !== 'string' || plan.goal.trim().length === 0) {
        throw new PlanValidationError('Plan goal is required');
    }
    if (typeof plan.rationale !== 'string') {
        throw new PlanValidationError('Plan rationale must be a string');
    }
    if (!Array.isArray(plan.steps)) {
        throw new PlanValidationError('Plan steps must be an array');
    }
    if (plan.steps.length > MAX_STEPS) {
        throw new PlanValidationError(`Plan may not contain more than ${MAX_STEPS} steps`);
    }

    plan.steps.forEach((step, index) => {
        if (!step || typeof step !== 'object') {
            throw new PlanValidationError(`Step ${index} is not an object`);
        }
        switch (step.kind) {
            case 'useTool': {
                if (typeof step.tool !== 'string' || step.tool.length === 0) {
                    throw new PlanValidationError(`Step ${index} is missing a tool name`);
                }
                const tool = getTool(step.tool);
                if (!tool) {
                    throw new PlanValidationError(`Step ${index} references unknown tool ${step.tool}`);
                }
                if (!step.args || typeof step.args !== 'object') {
                    throw new PlanValidationError(`Step ${index} must include args for tool ${step.tool}`);
                }
                break;
            }
            case 'execCode': {
                if (step.language !== 'node' && step.language !== 'shell') {
                    throw new PlanValidationError(`Step ${index} uses unsupported language ${step.language}`);
                }
                if (typeof step.code !== 'string' || step.code.trim().length === 0) {
                    throw new PlanValidationError(`Step ${index} must include executable code`);
                }
                break;
            }
            case 'askApproval': {
                if (typeof step.reason !== 'string' || step.reason.trim().length === 0) {
                    throw new PlanValidationError(`Step ${index} must include an approval reason`);
                }
                if (step.risk && !['read', 'write', 'exec', 'net'].includes(step.risk)) {
                    throw new PlanValidationError(`Step ${index} includes invalid risk ${step.risk}`);
                }
                break;
            }
            case 'summarize': {
                if (!Array.isArray(step.inputs)) {
                    throw new PlanValidationError(`Step ${index} summarize inputs must be an array`);
                }
                break;
            }
            default: {
                const exhaustive: never = step;
                throw new PlanValidationError(`Unsupported step kind ${(exhaustive as PlanStep).kind}`);
            }
        }
    });

    return plan;
}
