import { Tool } from './types';

const tools = new Map<string, Tool>();

export const registerTool = (tool: Tool): void => {
    tools.set(tool.name, tool);
};

export const getTool = (name: string): Tool | undefined => tools.get(name);

export const listTools = (): Tool[] => Array.from(tools.values());
