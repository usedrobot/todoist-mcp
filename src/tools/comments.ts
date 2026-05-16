import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { TodoistApi } from "@doist/todoist-sdk";
import { z } from "zod";
import { run } from "../utils/run.js";

export function registerCommentTools(server: McpServer, api: TodoistApi): void {
  server.registerTool(
    "find-comments",
    {
      description:
        "List comments on a task or project. Provide exactly one of taskId or projectId.",
      inputSchema: {
        taskId: z.string().optional(),
        projectId: z.string().optional(),
        cursor: z.string().optional(),
        limit: z.number().int().positive().max(200).optional(),
      },
    },
    async (args) =>
      run(async () => {
        if (!args.taskId && !args.projectId) {
          throw new Error("Provide taskId or projectId");
        }
        if (args.taskId && args.projectId) {
          throw new Error("Provide only one of taskId or projectId");
        }
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        return api.getComments({
          taskId: args.taskId,
          projectId: args.projectId,
          cursor: args.cursor ?? null,
          limit: args.limit,
        } as any);
      }),
  );

  server.registerTool(
    "get-comment",
    {
      description: "Get a single comment by id.",
      inputSchema: { id: z.string() },
    },
    async (args) => run(async () => api.getComment(args.id)),
  );

  server.registerTool(
    "add-comments",
    {
      description:
        "Add comments to tasks or projects (max 25). Each comment must target exactly one of taskId or projectId.",
      inputSchema: {
        comments: z.array(
          z.object({
            content: z.string(),
            taskId: z.string().optional(),
            projectId: z.string().optional(),
            attachment: z
              .object({
                fileUrl: z.string(),
                fileName: z.string().optional(),
                fileType: z.string().optional(),
                resourceType: z.string().optional(),
              })
              .optional(),
            uidsToNotify: z.array(z.string()).optional(),
          }),
        ).min(1).max(25),
      },
    },
    async (args) =>
      run(async () => {
        const created = [];
        for (const c of args.comments) {
          if (!c.taskId && !c.projectId) throw new Error("Each comment needs taskId or projectId");
          if (c.taskId && c.projectId) throw new Error("Provide only one of taskId or projectId");
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          created.push(await api.addComment(c as any));
        }
        return { created };
      }),
  );

  server.registerTool(
    "update-comments",
    {
      description: "Edit one or more comments.",
      inputSchema: {
        comments: z.array(
          z.object({ id: z.string(), content: z.string() }),
        ).min(1).max(25),
      },
    },
    async (args) =>
      run(async () => {
        const updated = [];
        for (const c of args.comments) {
          updated.push(await api.updateComment(c.id, { content: c.content }));
        }
        return { updated };
      }),
  );

  server.registerTool(
    "delete-comments",
    {
      description: "Delete one or more comments.",
      inputSchema: { ids: z.array(z.string()).min(1).max(25) },
    },
    async (args) =>
      run(async () => {
        const results = [];
        for (const id of args.ids) {
          await api.deleteComment(id);
          results.push({ id, status: "deleted" });
        }
        return { results };
      }),
  );
}
