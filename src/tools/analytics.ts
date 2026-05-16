import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { TodoistApi } from "@doist/todoist-sdk";
import { z } from "zod";
import { run } from "../utils/run.js";

export function registerAnalyticsTools(server: McpServer, api: TodoistApi): void {
  server.registerTool(
    "get-productivity-stats",
    {
      description:
        "Get karma score, daily/weekly streaks, completed task counts for the current user.",
      inputSchema: {},
    },
    async () => run(async () => api.getProductivityStats()),
  );

  server.registerTool(
    "get-project-activity-stats",
    {
      description:
        "Get activity statistics for a project. Defaults to last 2 weeks of completed item events. " +
        "NOTE: This endpoint only works for projects inside a Todoist Workspace (paid Business plan). " +
        "Personal projects return HTTP 400.",
      inputSchema: {
        projectId: z.string(),
        objectType: z.string().optional().describe("ITEM | PROJECT | NOTE (default ITEM)"),
        eventType: z.string().optional().describe(
          "ADDED | DELETED | UPDATED | ARCHIVED | UNARCHIVED | COMPLETED | UNCOMPLETED | SHARED | LEFT (default COMPLETED)",
        ),
        weeks: z.number().int().min(1).max(12).optional(),
        includeWeeklyCounts: z.boolean().optional(),
      },
    },
    async (args) =>
      run(async () =>
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        api.getProjectActivityStats(args.projectId, {
          objectType: args.objectType,
          eventType: args.eventType,
          weeks: args.weeks,
          includeWeeklyCounts: args.includeWeeklyCounts,
        } as any),
      ),
  );

  server.registerTool(
    "get-project-health",
    {
      description:
        "Get health score and indicators for a project (overdue tasks, stale tasks, etc). " +
        "NOTE: Workspace projects only.",
      inputSchema: { projectId: z.string() },
    },
    async (args) => run(async () => api.getProjectHealth(args.projectId)),
  );

  server.registerTool(
    "get-project-health-context",
    {
      description:
        "Get detailed context behind a project's health indicators. NOTE: Workspace projects only.",
      inputSchema: { projectId: z.string() },
    },
    async (args) => run(async () => api.getProjectHealthContext(args.projectId)),
  );

  server.registerTool(
    "get-project-progress",
    {
      description:
        "Get completion-progress summary for a project. NOTE: Workspace projects only.",
      inputSchema: { projectId: z.string() },
    },
    async (args) => run(async () => api.getProjectProgress(args.projectId)),
  );

  server.registerTool(
    "get-workspace-insights",
    {
      description: "Get aggregate workspace activity insights, optionally narrowed to projects.",
      inputSchema: {
        workspaceId: z.string(),
        projectIds: z.array(z.string()).optional(),
      },
    },
    async (args) =>
      run(async () =>
        api.getWorkspaceInsights(args.workspaceId, { projectIds: args.projectIds }),
      ),
  );

  server.registerTool(
    "find-workspace-members-activity",
    {
      description: "List recent activity events from workspace members.",
      inputSchema: {
        workspaceId: z.string(),
        userIds: z.string().optional().describe("Comma-separated user IDs"),
        projectIds: z.string().optional().describe("Comma-separated project IDs"),
      },
    },
    async (args) =>
      run(async () =>
        api.getWorkspaceMembersActivity({
          workspaceId: args.workspaceId,
          userIds: args.userIds ?? null,
          projectIds: args.projectIds ?? null,
        }),
      ),
  );
}
