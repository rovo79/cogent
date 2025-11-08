export type PlanStep =
    | {
          kind: 'useTool';
          tool: string;
          args: Record<string, unknown>;
          saveAs?: string;
          tokenEstimate?: number;
      }
    | {
          kind: 'execCode';
          language: 'node' | 'shell';
          code: string;
          saveAs?: string;
          tokenEstimate?: number;
      }
    | {
          kind: 'askApproval';
          reason: string;
          previewSlot?: string;
          tokenEstimate?: number;
      }
    | {
          kind: 'summarize';
          inputs: string[];
          saveAs?: string;
          tokenEstimate?: number;
      };

export interface Plan {
    goal: string;
    rationale: string;
    steps: PlanStep[];
}
