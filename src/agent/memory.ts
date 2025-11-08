import * as fs from 'fs/promises';

export interface Memory {
    projectPrefs: Record<string, unknown>;
    decisions: string[];
    facts: string[];
}

const EMPTY_MEMORY: Memory = {
    projectPrefs: {},
    decisions: [],
    facts: [],
};

export class MemoryStore {
    constructor(private readonly path: string) {}

    async load(): Promise<Memory> {
        try {
            const contents = await fs.readFile(this.path, 'utf8');
            return JSON.parse(contents) as Memory;
        } catch (error) {
            if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
                return { ...EMPTY_MEMORY };
            }
            throw error;
        }
    }

    async save(memory: Memory): Promise<void> {
        await fs.writeFile(this.path, JSON.stringify(memory, null, 2), 'utf8');
    }
}
