export interface Spec {
    id: string;
    title: string;
    acceptance: string[];
    constraints: string[];
    artifacts?: string[];
}

export function specsToPlan(spec: Spec): string {
    return [
        `Spec: ${spec.title}`,
        `Constraints: ${spec.constraints.join(' | ')}`,
        `Acceptance: ${spec.acceptance.join(' | ')}`,
    ].join('\n');
}
