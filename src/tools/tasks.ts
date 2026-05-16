import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { TodoistApi } from "@doist/todoist-sdk";
import { z } from "zod";
import { run } from "../utils/run.js";
import { priorityToRest } from "../utils/priority.js";

const PrioritySchema = z.enum(["p1", "p2", "p3", "p4"]);

export function registerTaskTools(server: McpServer, api: TodoistApi): void {
  server.registerTool(
    "find-tasks",
    {
      description:
        "Find active (non-completed) tasks. Either pass a Todoist filter `query` " +
        '(e.g. "today", "@tascam & #Amp Dash", "p1") OR narrow by projectId / sectionId / ' +
        "parentId / label. Pass `ids` for direct lookup. Returns up to `limit` results.",
      inputSchema: {
        query: z.string().optional().describe("Todoist filter query (mutually exclusive with the structural filters)"),
        lang: z.string().optional().describe("Filter query language (e.g. 'en', 'de'). Default 'en'."),
        projectId: z.string().optional(),
        sectionId: z.string().optional(),
        parentId: z.string().optional(),
        label: z.string().optional().describe("Single label name to filter by"),
        ids: z.array(z.string()).optional().describe("Fetch specific tasks by ID"),
        limit: z.number().int().positive().max(200).optional(),
        cursor: z.string().optional().describe("Pagination cursor from a previous response"),
      },
    },
    async (args) =>
      run(async () => {
        if (args.query) {
          return api.getTasksByFilter({
            query: args.query,
            lang: args.lang,
            cursor: args.cursor ?? null,
            limit: args.limit,
          });
        }
        return api.getTasks({
          projectId: args.projectId,
          sectionId: args.sectionId,
          parentId: args.parentId,
          label: args.label,
          ids: args.ids,
          cursor: args.cursor ?? null,
          limit: args.limit,
        });
      }),
  );

  server.registerTool(
    "find-tasks-by-date",
    {
      description:
        "Find active tasks due in a date range. Wraps find-tasks with a generated " +
        "Todoist filter query. For more complex date queries, use find-tasks with a custom query.",
      inputSchema: {
        startDate: z.string().describe("YYYY-MM-DD (inclusive)"),
        endDate: z.string().optional().describe("YYYY-MM-DD (inclusive). Defaults to startDate."),
        limit: z.number().int().positive().max(200).optional(),
        cursor: z.string().optional(),
      },
    },
    async (args) =>
      run(async () => {
        const end = args.endDate ?? args.startDate;
        const query = `due after: ${args.startDate} & due before: ${end}`;
        return api.getTasksByFilter({
          query,
          cursor: args.cursor ?? null,
          limit: args.limit,
        });
      }),
  );

  server.registerTool(
    "find-completed-tasks",
    {
      description:
        "Find completed tasks by completion-date or due-date range. Returns up to `limit` tasks " +
        "(max 200). Use `by: 'completion'` to search by when tasks were completed, or `by: 'due'` " +
        "for when they were due.",
      inputSchema: {
        by: z.enum(["completion", "due"]).default("completion"),
        since: z.string().describe("Start of range (YYYY-MM-DDTHH:MM:SS or YYYY-MM-DD)"),
        until: z.string().describe("End of range (YYYY-MM-DDTHH:MM:SS or YYYY-MM-DD)"),
        projectId: z.string().optional(),
        sectionId: z.string().optional(),
        parentId: z.string().optional(),
        workspaceId: z.string().optional(),
        filterQuery: z.string().optional().describe("Additional Todoist filter query"),
        limit: z.number().int().positive().max(200).optional(),
        cursor: z.string().optional(),
      },
    },
    async (args) =>
      run(async () => {
        const common = {
          since: args.since,
          until: args.until,
          projectId: args.projectId,
          sectionId: args.sectionId,
          parentId: args.parentId,
          workspaceId: args.workspaceId,
          filterQuery: args.filterQuery,
          cursor: args.cursor ?? null,
          limit: args.limit,
        };
        return args.by === "due"
          ? api.getCompletedTasksByDueDate(common)
          : api.getCompletedTasksByCompletionDate(common);
      }),
  );

  const TaskCreateSchema = z.object({
    content: z.string().describe("Task title/content (supports Markdown)"),
    description: z.string().optional(),
    projectId: z.string().optional(),
    sectionId: z.string().optional(),
    parentId: z.string().optional(),
    labels: z.array(z.string()).optional(),
    priority: PrioritySchema.optional().describe("p1 highest, p4 lowest/default"),
    assigneeId: z.string().optional(),
    dueString: z.string().optional().describe(
      "Natural language due date e.g. 'tomorrow', 'every Monday 10am'. " +
        "For recurring tasks, the recurrence pattern is preserved on subsequent updates only if you " +
        "use reschedule-tasks (not update-tasks).",
    ),
    dueDate: z.string().optional().describe("YYYY-MM-DD"),
    dueDatetime: z.string().optional().describe("ISO 8601 datetime (RFC 3339)"),
    deadlineDate: z.string().optional().describe("YYYY-MM-DD"),
    duration: z.number().int().positive().optional(),
    durationUnit: z.enum(["minute", "day"]).optional(),
    order: z.number().int().optional(),
  });

  server.registerTool(
    "add-tasks",
    {
      description: "Create one or more tasks (max 25 per call).",
      inputSchema: {
        tasks: z.array(TaskCreateSchema).min(1).max(25),
      },
    },
    async (args) =>
      run(async () => {
        const created = [];
        for (const t of args.tasks) {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const payload: any = {
            content: t.content,
            description: t.description,
            projectId: t.projectId,
            sectionId: t.sectionId,
            parentId: t.parentId,
            labels: t.labels,
            priority: t.priority ? priorityToRest(t.priority) : undefined,
            assigneeId: t.assigneeId,
            dueString: t.dueString,
            dueDate: t.dueDate,
            dueDatetime: t.dueDatetime,
            deadlineDate: t.deadlineDate,
            duration: t.duration,
            durationUnit: t.durationUnit,
            order: t.order,
          };
          const task = await api.addTask(payload);
          created.push(task);
        }
        return { created };
      }),
  );

  server.registerTool(
    "update-tasks",
    {
      description:
        "Update one or more tasks. Only fields present in the patch are changed. " +
        "WARNING: Do NOT use this to reschedule a recurring task — passing dueString or dueDate " +
        "overwrites the recurrence pattern. Use reschedule-tasks instead for recurring tasks.",
      inputSchema: {
        tasks: z.array(
          z.object({
            id: z.string(),
            content: z.string().optional(),
            description: z.string().optional(),
            labels: z.array(z.string()).optional(),
            priority: PrioritySchema.optional(),
            assigneeId: z.string().nullable().optional(),
            dueString: z.string().nullable().optional().describe("Use null or 'no date' to clear"),
            dueDate: z.string().optional(),
            dueDatetime: z.string().optional(),
            deadlineDate: z.string().nullable().optional().describe("YYYY-MM-DD or null to clear"),
            duration: z.number().int().positive().optional(),
            durationUnit: z.enum(["minute", "day"]).optional(),
            order: z.number().int().optional(),
          }),
        ).min(1).max(25),
      },
    },
    async (args) =>
      run(async () => {
        const updated = [];
        for (const t of args.tasks) {
          const { id, priority, ...rest } = t;
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const payload: any = { ...rest };
          if (priority !== undefined) payload.priority = priorityToRest(priority);
          const task = await api.updateTask(id, payload);
          updated.push(task);
        }
        return { updated };
      }),
  );

  server.registerTool(
    "reschedule-tasks",
    {
      description:
        "Reschedule one or more tasks to a new date/time. Preserves recurrence patterns and " +
        "existing time-of-day on recurring tasks (only the next occurrence is moved). " +
        "Always prefer this over update-tasks when changing when a task is due.",
      inputSchema: {
        tasks: z.array(
          z.object({
            id: z.string(),
            dueDate: z.string().optional().describe("YYYY-MM-DD"),
            dueDatetime: z.string().optional().describe("ISO 8601 with optional timezone"),
          }).refine((v) => v.dueDate || v.dueDatetime, {
            message: "Provide dueDate or dueDatetime",
          }),
        ).min(1).max(50),
      },
    },
    async (args) =>
      run(async () => {
        const rescheduled = [];
        for (const t of args.tasks) {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const payload: any = {};
          if (t.dueDatetime) payload.dueDatetime = t.dueDatetime;
          else if (t.dueDate) payload.dueDate = t.dueDate;
          const task = await api.updateTask(t.id, payload);
          rescheduled.push(task);
        }
        return { rescheduled };
      }),
  );

  server.registerTool(
    "complete-tasks",
    {
      description: "Mark one or more tasks as complete.",
      inputSchema: {
        ids: z.array(z.string()).min(1).max(50),
      },
    },
    async (args) =>
      run(async () => {
        const results = [];
        for (const id of args.ids) {
          await api.closeTask(id);
          results.push({ id, status: "completed" });
        }
        return { results };
      }),
  );

  server.registerTool(
    "uncomplete-tasks",
    {
      description: "Reopen one or more completed tasks.",
      inputSchema: {
        ids: z.array(z.string()).min(1).max(50),
      },
    },
    async (args) =>
      run(async () => {
        const results = [];
        for (const id of args.ids) {
          await api.reopenTask(id);
          results.push({ id, status: "reopened" });
        }
        return { results };
      }),
  );

  server.registerTool(
    "move-tasks",
    {
      description:
        "Move one or more tasks. Exactly one of projectId / sectionId / parentId is required.",
      inputSchema: {
        ids: z.array(z.string()).min(1).max(50),
        projectId: z.string().optional(),
        sectionId: z.string().optional(),
        parentId: z.string().optional(),
      },
    },
    async (args) =>
      run(async () => {
        const provided = [args.projectId, args.sectionId, args.parentId].filter(Boolean).length;
        if (provided !== 1) {
          throw new Error("Provide exactly one of projectId, sectionId, parentId");
        }
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const moveArgs: any = {};
        if (args.projectId) moveArgs.projectId = args.projectId;
        if (args.sectionId) moveArgs.sectionId = args.sectionId;
        if (args.parentId) moveArgs.parentId = args.parentId;
        return api.moveTasks(args.ids, moveArgs);
      }),
  );

  server.registerTool(
    "delete-tasks",
    {
      description: "Permanently delete one or more tasks. Use complete-tasks for normal completion.",
      inputSchema: {
        ids: z.array(z.string()).min(1).max(50),
      },
    },
    async (args) =>
      run(async () => {
        const results = [];
        for (const id of args.ids) {
          await api.deleteTask(id);
          results.push({ id, status: "deleted" });
        }
        return { results };
      }),
  );

  server.registerTool(
    "quick-add-task",
    {
      description:
        "Create a task from natural-language input (Todoist Quick Add syntax). " +
        "E.g. 'Buy milk tomorrow @errands #Home p1'.",
      inputSchema: {
        text: z.string(),
        note: z.string().optional(),
        reminder: z.string().optional(),
        autoReminder: z.boolean().optional(),
      },
    },
    async (args) => run(async () => api.quickAddTask(args)),
  );
}
