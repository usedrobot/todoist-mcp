import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { TodoistApi } from "@doist/todoist-sdk";
import { z } from "zod";
import { run } from "../utils/run.js";

export function registerLabelTools(server: McpServer, api: TodoistApi): void {
  server.registerTool(
    "find-labels",
    {
      description: "List personal labels.",
      inputSchema: {
        cursor: z.string().optional(),
        limit: z.number().int().positive().max(200).optional(),
      },
    },
    async (args) =>
      run(async () => api.getLabels({ cursor: args.cursor ?? null, limit: args.limit })),
  );

  server.registerTool(
    "get-label",
    {
      description: "Get a single label by id.",
      inputSchema: { id: z.string() },
    },
    async (args) => run(async () => api.getLabel(args.id)),
  );

  server.registerTool(
    "add-labels",
    {
      description: "Create one or more labels.",
      inputSchema: {
        labels: z.array(
          z.object({
            name: z.string(),
            color: z.string().optional(),
            order: z.number().int().nullable().optional(),
            isFavorite: z.boolean().optional(),
          }),
        ).min(1).max(25),
      },
    },
    async (args) =>
      run(async () => {
        const created = [];
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        for (const l of args.labels) created.push(await api.addLabel(l as any));
        return { created };
      }),
  );

  server.registerTool(
    "update-labels",
    {
      description: "Update one or more labels.",
      inputSchema: {
        labels: z.array(
          z.object({
            id: z.string(),
            name: z.string().optional(),
            color: z.string().optional(),
            order: z.number().int().nullable().optional(),
            isFavorite: z.boolean().optional(),
          }),
        ).min(1).max(25),
      },
    },
    async (args) =>
      run(async () => {
        const updated = [];
        for (const l of args.labels) {
          const { id, ...rest } = l;
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          updated.push(await api.updateLabel(id, rest as any));
        }
        return { updated };
      }),
  );

  server.registerTool(
    "delete-labels",
    {
      description: "Permanently delete one or more labels.",
      inputSchema: { ids: z.array(z.string()).min(1).max(25) },
    },
    async (args) =>
      run(async () => {
        const results = [];
        for (const id of args.ids) {
          await api.deleteLabel(id);
          results.push({ id, status: "deleted" });
        }
        return { results };
      }),
  );

  server.registerTool(
    "find-shared-labels",
    {
      description: "List shared labels (used in any task you can see).",
      inputSchema: {
        omitPersonal: z.boolean().optional(),
        cursor: z.string().optional(),
        limit: z.number().int().positive().max(200).optional(),
      },
    },
    async (args) =>
      run(async () =>
        api.getSharedLabels({
          omitPersonal: args.omitPersonal,
          cursor: args.cursor ?? null,
          limit: args.limit,
        }),
      ),
  );

  server.registerTool(
    "rename-shared-label",
    {
      description: "Rename a shared label across all tasks that use it.",
      inputSchema: { name: z.string(), newName: z.string() },
    },
    async (args) => run(async () => api.renameSharedLabel(args)),
  );

  server.registerTool(
    "remove-shared-label",
    {
      description: "Remove a shared label from all tasks that use it.",
      inputSchema: { name: z.string() },
    },
    async (args) => run(async () => api.removeSharedLabel(args)),
  );
}
