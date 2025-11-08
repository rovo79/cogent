export type ToolParam = {
    name: string;
    type: string;
    required?: boolean;
};

export type ToolIO = {
    params: ToolParam[];
    returns: string;
};

export type ToolRisk = 'read' | 'write' | 'exec' | 'net';

export interface ToolContext {
    cwd: string;
    env: Record<string, string>;
    writeUserMessage: (msg: string) => void;
}

export interface Tool {
    name: string;
    description: string;
    io: ToolIO;
    risk: ToolRisk;
    preferredMode?: 'MCP' | 'codeExec';
    autoApprove?: boolean;
    getApprovalPreview?: (args: Record<string, unknown>) => string | Promise<string>;
    run: (args: Record<string, unknown>, ctx: ToolContext) => Promise<unknown>;
}
