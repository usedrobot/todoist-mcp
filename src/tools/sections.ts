import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { TodoistApi } from "@doist/todoist-sdk";
import { z } from "zod";
import { run } from "../utils/run.js";

export function registerSectionTools(server: McpServer, api: TodoistApi): void {
  server.registerTool(
    "find-sections",
    {
      description: "List sections, optionally filtered by project.",
      inputSchema: {
        projectId: z.string().optional(),
        cursor: z.string().optional(),
        limit: z.number().int().positive().max(200).optional(),
      },
    },
    async (args) =>
      run(async () =>
        api.getSections({
          projectId: args.projectId ?? null,
          cursor: args.cursor ?? null,
          limit: args.limit,
        }),
      ),
  );

  server.registerTool(
    "get-section",
    {
      description: "Get a single section by id.",
      inputSchema: { id: z.string() },
    },
    async (args) => run(async () => api.getSection(args.id)),
  );

  server.registerTool(
    "add-sections",
    {
      description: "Create one or more sections.",
      inputSchema: {
        sections: z.array(
          z.object({
            name: z.string(),
            projectId: z.string(),
            order: z.number().int().nullable().optional(),
          }),
        ).min(1).max(25),
      },
    },
    async (args) =>
      run(async () => {
        const created = [];
        for (const s of args.sections) created.push(await api.addSection(s));
        return { created };
      }),
  );

  server.registerTool(
    "update-sections",
    {
      description: "Rename one or more sections.",
      inputSchema: {
        sections: z.array(
          z.object({ id: z.string(), name: z.string() }),
        ).min(1).max(25),
      },
    },
    async (args) =>
      run(async () => {
        const updated = [];
        for (const s of args.sections) {
          updated.push(await api.updateSection(s.id, { name: s.name }));
        }
        return { updated };
      }),
  );

  server.registerTool(
    "delete-sections",
    {
      description: "Permanently delete one or more sections.",
      inputSchema: { ids: z.array(z.string()).min(1).max(25) },
    },
    async (args) =>
      run(async () => {
        const results = [];
        for (const id of args.ids) {
          await api.deleteSection(id);
          results.push({ id, status: "deleted" });
        }
        return { results };
      }),
  );
}
