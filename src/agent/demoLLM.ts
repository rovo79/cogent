import { Plan } from './plans';

export interface CompletionUsage {
    promptTokens: number;
    responseTokens: number;
    latencyMs: number;
}

export interface CompletionResult {
    text: string;
    usage: CompletionUsage;
}

function estimateTokens(text: string): number {
    return text.split(/\s+/).filter(Boolean).length;
}

function buildDeterministicPlan(): Plan {
    return {
        goal: 'Refactor hotspot report using deterministic guardrails',
        rationale: 'Demonstrates end-to-end planning, approvals, and diff-first writes.',
        steps: [
            {
                kind: 'useTool',
                tool: 'read_file',
                args: { path: 'assets/hotspots-demo.txt' },
                saveAs: 'hotspotSource',
                tokenEstimate: 120,
            },
            {
                kind: 'useTool',
                tool: 'prepare_hotspot_diff',
                args: { path: 'assets/hotspots-demo.txt' },
                saveAs: 'hotspotPatch',
                tokenEstimate: 90,
            },
            {
                kind: 'askApproval',
                reason: 'Apply deterministic hotspot refactor patch',
                previewSlot: 'hotspotPatch',
                tokenEstimate: 5,
            },
            {
                kind: 'useTool',
                tool: 'apply_hotspot_patch',
                args: { patch: { $slot: 'hotspotPatch' } },
                tokenEstimate: 40,
            },
            {
                kind: 'summarize',
                inputs: ['hotspotPatch'],
                saveAs: 'summary',
                tokenEstimate: 30,
            },
        ],
    };
}

export class DeterministicLLMClient {
    async complete(prompt: string): Promise<CompletionResult> {
        const started = Date.now();
        const plan = buildDeterministicPlan();
        const response = JSON.stringify(plan);
        const latencyMs = Date.now() - started;
        return {
            text: response,
            usage: {
                promptTokens: estimateTokens(prompt),
                responseTokens: estimateTokens(response),
                latencyMs,
            },
        };
    }
}
