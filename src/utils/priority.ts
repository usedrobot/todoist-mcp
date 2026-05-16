/**
 * Todoist exposes two opposing priority conventions:
 *   - REST API: 1 = no priority (lowest), 4 = urgent (highest)
 *   - UI / MCP convention: p1 = urgent (highest), p4 = no priority (lowest)
 *
 * Tools accept p1-p4 strings and translate to REST integers internally.
 */

export type PriorityString = "p1" | "p2" | "p3" | "p4";

const TO_REST: Record<PriorityString, number> = { p1: 4, p2: 3, p3: 2, p4: 1 };
const FROM_REST: Record<number, PriorityString> = { 4: "p1", 3: "p2", 2: "p3", 1: "p4" };

export function priorityToRest(p: PriorityString): number {
  return TO_REST[p];
}

export function priorityFromRest(n: number): PriorityString {
  return FROM_REST[n] ?? "p4";
}
