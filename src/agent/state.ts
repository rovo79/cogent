export interface AgentState {
    goal: string;
    planId?: string;
    stepIndex: number;
}

export function createInitialState(goal: string): AgentState {
    return {
        goal,
        stepIndex: 0,
    };
}
