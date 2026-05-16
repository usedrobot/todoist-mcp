import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { TodoistApi } from "@doist/todoist-sdk";
import { z } from "zod";
import { run } from "../utils/run.js";

const ColorSchema = z.string().describe(
  "Color key (e.g. 'berry_red', 'red', 'orange', 'yellow', 'olive_green', 'lime_green', 'green', 'mint_green', 'teal', 'sky_blue', 'light_blue', 'blue', 'grape', 'violet', 'lavender', 'magenta', 'salmon', 'charcoal', 'grey', 'taupe')",
);
const ViewStyleSchema = z.enum(["list", "board", "calendar"]);

export function registerProjectTools(server: McpServer, api: TodoistApi): void {
  server.registerTool(
    "find-projects",
    {
      description: "List projects. Optionally narrow by folder or workspace.",
      inputSchema: {
        folderId: z.string().optional(),
        workspaceId: z.string().optional(),
        cursor: z.string().optional(),
        limit: z.number().int().positive().max(200).optional(),
      },
    },
    async (args) =>
      run(async () =>
        api.getProjects({
          folderId: args.folderId,
          workspaceId: args.workspaceId,
          cursor: args.cursor ?? null,
          limit: args.limit,
        }),
      ),
  );

  server.registerTool(
    "search-projects",
    {
      description: "Search projects by name.",
      inputSchema: {
        query: z.string(),
        cursor: z.string().optional(),
        limit: z.number().int().positive().max(200).optional(),
      },
    },
    async (args) =>
      run(async () =>
        api.searchProjects({
          query: args.query,
          cursor: args.cursor ?? null,
          limit: args.limit,
        }),
      ),
  );

  server.registerTool(
    "get-project",
    {
      description: "Get a single project, optionally with its full task tree.",
      inputSchema: {
        id: z.string(),
        full: z.boolean().optional().describe("If true, returns sections + tasks + collaborators"),
      },
    },
    async (args) =>
      run(async () => (args.full ? api.getFullProject(args.id) : api.getProject(args.id))),
  );

  server.registerTool(
    "add-projects",
    {
      description: "Create one or more projects (max 25).",
      inputSchema: {
        projects: z.array(
          z.object({
            name: z.string(),
            parentId: z.string().optional(),
            color: ColorSchema.optional(),
            isFavorite: z.boolean().optional(),
            viewStyle: ViewStyleSchema.optional(),
            workspaceId: z.string().optional(),
          }),
        ).min(1).max(25),
      },
    },
    async (args) =>
      run(async () => {
        const created = [];
        for (const p of args.projects) {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          created.push(await api.addProject(p as any));
        }
        return { created };
      }),
  );

  server.registerTool(
    "update-projects",
    {
      description: "Update one or more projects.",
      inputSchema: {
        projects: z.array(
          z.object({
            id: z.string(),
            name: z.string().optional(),
            color: ColorSchema.optional(),
            isFavorite: z.boolean().optional(),
            viewStyle: ViewStyleSchema.optional(),
            folderId: z.string().nullable().optional(),
          }),
        ).min(1).max(25),
      },
    },
    async (args) =>
      run(async () => {
        const updated = [];
        for (const p of args.projects) {
          const { id, ...rest } = p;
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          updated.push(await api.updateProject(id, rest as any));
        }
        return { updated };
      }),
  );

  server.registerTool(
    "delete-projects",
    {
      description: "Permanently delete one or more projects.",
      inputSchema: {
        ids: z.array(z.string()).min(1).max(25),
      },
    },
    async (args) =>
      run(async () => {
        const results = [];
        for (const id of args.ids) {
          await api.deleteProject(id);
          results.push({ id, status: "deleted" });
        }
        return { results };
      }),
  );

  server.registerTool(
    "move-project",
    {
      description: "Move a project between workspaces or to personal.",
      inputSchema: {
        projectId: z.string(),
        target: z.enum(["workspace", "personal"]),
        workspaceId: z.string().optional().describe("Required when target is 'workspace'"),
      },
    },
    async (args) =>
      run(async () => {
        if (args.target === "workspace") {
          if (!args.workspaceId) throw new Error("workspaceId required for workspace target");
          return api.moveProjectToWorkspace({
            projectId: args.projectId,
            workspaceId: args.workspaceId,
          });
        }
        return api.moveProjectToPersonal({ projectId: args.projectId });
      }),
  );

  server.registerTool(
    "find-project-collaborators",
    {
      description: "List collaborators on a shared project.",
      inputSchema: {
        projectId: z.string(),
        cursor: z.string().optional(),
        limit: z.number().int().positive().max(200).optional(),
      },
    },
    async (args) =>
      run(async () =>
        api.getProjectCollaborators(args.projectId, {
          cursor: args.cursor ?? null,
          limit: args.limit,
        }),
      ),
  );

  server.registerTool(
    "get-archived-projects",
    {
      description: "List archived projects.",
      inputSchema: {
        cursor: z.string().optional(),
        limit: z.number().int().positive().max(200).optional(),
      },
    },
    async (args) =>
      run(async () => api.getArchivedProjects({ cursor: args.cursor ?? null, limit: args.limit })),
  );
}
