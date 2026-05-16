import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { TodoistApi } from "@doist/todoist-sdk";
import { createCommand } from "@doist/todoist-sdk";
import { z } from "zod";
import { run } from "../utils/run.js";

/**
 * Filters are not exposed via the REST API. We use the Sync API directly via
 * `api.sync({ resourceTypes: ['filters'] })` for reads and `createCommand('filter_*')`
 * for mutations.
 */
export function registerFilterTools(server: McpServer, api: TodoistApi): void {
  server.registerTool(
    "find-filters",
    {
      description: "List all filters defined on this account.",
      inputSchema: {},
    },
    async () =>
      run(async () => {
        const res = await api.sync({ resourceTypes: ["filters"], syncToken: "*" });
        return { filters: res.filters ?? [] };
      }),
  );

  server.registerTool(
    "add-filters",
    {
      description: "Create one or more saved filters.",
      inputSchema: {
        filters: z.array(
          z.object({
            name: z.string(),
            query: z.string().describe("Todoist filter query (e.g. '@tascam & #Amp Dash')"),
            color: z.string().optional(),
            itemOrder: z.number().int().optional(),
            isFavorite: z.boolean().optional(),
          }),
        ).min(1).max(25),
      },
    },
    async (args) =>
      run(async () => {
        const commands = args.filters.map((f) =>
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          createCommand("filter_add", f as any),
        );
        const res = await api.sync({ commands });
        return {
          tempIdMapping: res.tempIdMapping,
          syncStatus: res.syncStatus,
        };
      }),
  );

  server.registerTool(
    "update-filters",
    {
      description: "Update one or more filters.",
      inputSchema: {
        filters: z.array(
          z.object({
            id: z.string(),
            name: z.string().optional(),
            query: z.string().optional(),
            color: z.string().optional(),
            itemOrder: z.number().int().optional(),
            isFavorite: z.boolean().optional(),
          }),
        ).min(1).max(25),
      },
    },
    async (args) =>
      run(async () => {
        const commands = args.filters.map((f) =>
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          createCommand("filter_update", f as any),
        );
        const res = await api.sync({ commands });
        return { syncStatus: res.syncStatus };
      }),
  );

  server.registerTool(
    "delete-filters",
    {
      description: "Delete one or more filters.",
      inputSchema: {
        ids: z.array(z.string()).min(1).max(25),
      },
    },
    async (args) =>
      run(async () => {
        const commands = args.ids.map((id) => createCommand("filter_delete", { id }));
        const res = await api.sync({ commands });
        return { syncStatus: res.syncStatus };
      }),
  );
}
