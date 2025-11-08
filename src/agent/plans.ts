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
