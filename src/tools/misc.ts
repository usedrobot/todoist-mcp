import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { TodoistApi } from "@doist/todoist-sdk";
import { z } from "zod";
import { run } from "../utils/run.js";

export function registerMiscTools(server: McpServer, api: TodoistApi): void {
  server.registerTool(
    "user-info",
    {
      description: "Get the authenticated user's account info.",
      inputSchema: {},
    },
    async () => run(async () => api.getUser()),
  );

  server.registerTool(
    "find-activity",
    {
      description:
        "Search the activity log. Filter by object type/id, event type, parent project/task, etc.",
      inputSchema: {
        parentProjectId: z.string().optional(),
        parentItemId: z.string().optional(),
        objectId: z.string().optional(),
        initiatorId: z.string().optional(),
        since: z.string().optional().describe("ISO 8601"),
        until: z.string().optional().describe("ISO 8601"),
        limit: z.number().int().positive().max(100).optional(),
        offset: z.number().int().nonnegative().optional(),
      },
    },
    async (args) =>
      run(async () =>
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        api.getActivityLogs(args as any),
      ),
  );

  server.registerTool(
    "search",
    {
      description:
        "OpenAI-MCP-compatible search across tasks. Wraps find-tasks with a query string.",
      inputSchema: {
        query: z.string(),
        limit: z.number().int().positive().max(200).optional(),
      },
    },
    async (args) =>
      run(async () =>
        api.getTasksByFilter({ query: args.query, limit: args.limit, cursor: null }),
      ),
  );

  server.registerTool(
    "fetch",
    {
      description: "OpenAI-MCP-compatible fetch by entity type and id.",
      inputSchema: {
        type: z.enum(["task", "project", "section", "label", "comment", "filter", "reminder"]),
        id: z.string(),
      },
    },
    async (args) =>
      run(async () => {
        switch (args.type) {
          case "task":
            return api.getTask(args.id);
          case "project":
            return api.getProject(args.id);
          case "section":
            return api.getSection(args.id);
          case "label":
            return api.getLabel(args.id);
          case "comment":
            return api.getComment(args.id);
          case "reminder":
            return api.getReminder(args.id);
          case "filter": {
            const res = await api.sync({ resourceTypes: ["filters"], syncToken: "*" });
            const found = (res.filters ?? []).find((f: { id: string }) => f.id === args.id);
            if (!found) throw new Error(`Filter ${args.id} not found`);
            return found;
          }
          default:
            throw new Error(`Unsupported type: ${args.type as string}`);
        }
      }),
  );

  server.registerTool(
    "upload-file",
    {
      description:
        "Upload a file to Todoist for use as a comment attachment. Provide either fileUrl (remote) " +
        "or fileContent (base64) + fileName.",
      inputSchema: {
        fileName: z.string(),
        fileContent: z.string().optional().describe("Base64-encoded file contents"),
        fileUrl: z.string().optional().describe("Remote file URL"),
      },
    },
    async (args) =>
      run(async () => {
        if (!args.fileContent && !args.fileUrl) {
          throw new Error("Provide fileContent or fileUrl");
        }
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        return api.uploadFile(args as any);
      }),
  );

  server.registerTool(
    "get-backups",
    {
      description: "List available account backups.",
      inputSchema: {},
    },
    async () => run(async () => api.getBackups()),
  );
}
