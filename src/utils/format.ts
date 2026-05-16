import type { CallToolResult } from "@modelcontextprotocol/sdk/types.js";

export function ok(data: unknown): CallToolResult {
  return {
    content: [{ type: "text", text: JSON.stringify(data, null, 2) }],
  };
}

export function okText(text: string): CallToolResult {
  return { content: [{ type: "text", text }] };
}

export function fail(message: string): CallToolResult {
  return {
    isError: true,
    content: [{ type: "text", text: message }],
  };
}
