import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { TodoistApi } from "@doist/todoist-sdk";
import { z } from "zod";
import { run } from "../utils/run.js";

export function registerWorkspaceTools(server: McpServer, api: TodoistApi): void {
  server.registerTool(
    "list-workspaces",
    {
      description: "List all workspaces the user is a member of.",
      inputSchema: {},
    },
    async () => run(async () => api.getWorkspaces()),
  );

  server.registerTool(
    "get-workspace",
    {
      description: "Get a single workspace by id.",
      inputSchema: { id: z.string() },
    },
    async (args) => run(async () => api.getWorkspace(args.id)),
  );

  server.registerTool(
    "find-workspace-users",
    {
      description: "List users in a workspace.",
      inputSchema: {
        workspaceId: z.string(),
        cursor: z.string().optional(),
        limit: z.number().int().positive().max(200).optional(),
      },
    },
    async (args) =>
      run(async () =>
        api.getWorkspaceUsers({
          workspaceId: args.workspaceId,
          cursor: args.cursor ?? null,
          limit: args.limit,
        }),
      ),
  );

  server.registerTool(
    "find-workspace-projects",
    {
      description: "List active projects in a workspace.",
      inputSchema: {
        workspaceId: z.string(),
        cursor: z.string().optional(),
        limit: z.number().int().positive().max(200).optional(),
      },
    },
    async (args) =>
      run(async () =>
        api.getWorkspaceActiveProjects({
          workspaceId: args.workspaceId,
          cursor: args.cursor ?? null,
          limit: args.limit,
        }),
      ),
  );

  server.registerTool(
    "find-workspace-user-tasks",
    {
      description: "List tasks assigned to a specific user in a workspace.",
      inputSchema: {
        workspaceId: z.string(),
        userId: z.string(),
        projectIds: z.string().optional().describe("Comma-separated project IDs to narrow"),
      },
    },
    async (args) =>
      run(async () =>
        api.getWorkspaceUserTasks({
          workspaceId: args.workspaceId,
          userId: args.userId,
          projectIds: args.projectIds ?? null,
        }),
      ),
  );
}
