export type ToolParam = {
    name: string;
    type: string;
    required?: boolean;
};

export type ToolIO = {
    params: ToolParam[];
    returns: string;
};

export interface ToolContext {
    cwd: string;
    env: Record<string, string>;
    writeUserMessage: (msg: string) => void;
}

export interface Tool {
    name: string;
    description: string;
    io: ToolIO;
    preferredMode?: 'MCP' | 'codeExec';
    run: (args: Record<string, unknown>, ctx: ToolContext) => Promise<unknown>;
}
