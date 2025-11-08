export interface DiffPreview {
    path: string;
    diff: string;
}

export function renderDiffs(diffs: DiffPreview[]): string {
    return diffs
        .map((diff) => [`# ${diff.path}`, '```diff', diff.diff.trimEnd(), '```'].join('\n'))
        .join('\n\n');
}
