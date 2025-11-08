import { Tool, ToolRisk } from './types';

const tools = new Map<string, Tool>();

export const registerTool = (tool: Tool): void => {
    if (tools.has(tool.name)) {
        throw new Error(`Tool already registered: ${tool.name}`);
    }
    tools.set(tool.name, tool);
};

export const getTool = (name: string): Tool | undefined => tools.get(name);

export const listTools = (): Tool[] => Array.from(tools.values());

export const getToolRisk = (name: string): ToolRisk | undefined => tools.get(name)?.risk;

export const toolRequiresApproval = (tool: Tool): boolean => tool.risk !== 'read' && !tool.autoApprove;
