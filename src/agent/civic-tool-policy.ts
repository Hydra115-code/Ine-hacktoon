import { type AgentToolCall, type AgentToolDefinition } from "./schemas/agent.schema.js";

export const CIVIC_TOOL_NAMES = [
  "get_participation_summary",
  "compare_elections",
  "get_participation_breakdown",
  "get_supporting_records",
] as const;

const ALLOWED_TOOLS = new Set<string>(CIVIC_TOOL_NAMES);

export function selectAllowedTools(
  definitions: AgentToolDefinition[],
  permittedToolNames: readonly string[] = CIVIC_TOOL_NAMES,
): AgentToolDefinition[] {
  const permittedTools = new Set(permittedToolNames);
  return definitions.filter((tool) => (
    ALLOWED_TOOLS.has(tool.name) && permittedTools.has(tool.name)
  ));
}

export function isAllowedTool(toolName: string): boolean {
  return ALLOWED_TOOLS.has(toolName);
}

export function toolCallFingerprint(call: AgentToolCall): string {
  return JSON.stringify([call.name, sortObject(call.arguments)]);
}

function sortObject(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(sortObject);
  if (!value || typeof value !== "object") return value;

  return Object.fromEntries(
    Object.entries(value as Record<string, unknown>)
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([key, item]) => [key, sortObject(item)]),
  );
}
