import type { CallToolResult } from "@modelcontextprotocol/sdk/types.js";
import { fail, ok } from "./format.js";
import { formatError } from "./errors.js";

/**
 * Wraps a tool handler so any thrown error becomes an isError CallToolResult
 * instead of crashing the MCP transport.
 */
export function run<T>(fn: () => Promise<T>): Promise<CallToolResult> {
  return fn().then(ok).catch((err) => fail(formatError(err)));
}
