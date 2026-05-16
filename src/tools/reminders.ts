import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { TodoistApi } from "@doist/todoist-sdk";
import { z } from "zod";
import { run } from "../utils/run.js";

const DueSchema = z.object({
  string: z.string().optional(),
  isRecurring: z.boolean().optional(),
  date: z.string().optional(),
  timezone: z.string().nullable().optional(),
  lang: z.string().nullable().optional(),
});

export function registerReminderTools(server: McpServer, api: TodoistApi): void {
  server.registerTool(
    "find-reminders",
    {
      description: "List time-based reminders, optionally filtered by task.",
      inputSchema: {
        taskId: z.string().optional(),
        cursor: z.string().optional(),
        limit: z.number().int().positive().max(200).optional(),
      },
    },
    async (args) =>
      run(async () =>
        api.getReminders({
          taskId: args.taskId ?? null,
          cursor: args.cursor ?? null,
          limit: args.limit,
        }),
      ),
  );

  server.registerTool(
    "find-location-reminders",
    {
      description: "List location-based reminders, optionally filtered by task.",
      inputSchema: {
        taskId: z.string().optional(),
        cursor: z.string().optional(),
        limit: z.number().int().positive().max(200).optional(),
      },
    },
    async (args) =>
      run(async () =>
        api.getLocationReminders({
          taskId: args.taskId ?? null,
          cursor: args.cursor ?? null,
          limit: args.limit,
        }),
      ),
  );

  server.registerTool(
    "add-reminder",
    {
      description:
        "Add a time-based reminder to a task. Either relative (minuteOffset) or absolute (due).",
      inputSchema: {
        taskId: z.string(),
        type: z.enum(["relative", "absolute"]),
        minuteOffset: z
          .number()
          .int()
          .optional()
          .describe("For relative reminders: minutes before due date"),
        due: DueSchema.optional().describe("For absolute reminders"),
        service: z.enum(["email", "push"]).optional(),
        notifyUid: z.string().optional(),
        isUrgent: z.boolean().optional(),
      },
    },
    async (args) =>
      run(async () => {
        if (args.type === "relative") {
          if (args.minuteOffset === undefined) {
            throw new Error("minuteOffset is required for relative reminders");
          }
          return api.addReminder({
            taskId: args.taskId,
            minuteOffset: args.minuteOffset,
            service: args.service,
            notifyUid: args.notifyUid,
            isUrgent: args.isUrgent,
          });
        }
        if (!args.due) throw new Error("due is required for absolute reminders");
        return api.addReminder({
          taskId: args.taskId,
          reminderType: "absolute",
          due: args.due,
          service: args.service,
          notifyUid: args.notifyUid,
          isUrgent: args.isUrgent,
        });
      }),
  );

  server.registerTool(
    "add-location-reminder",
    {
      description: "Add a geolocation-triggered reminder to a task.",
      inputSchema: {
        taskId: z.string(),
        name: z.string().describe("Location name (e.g. 'Home', 'Office')"),
        locLat: z.string(),
        locLong: z.string(),
        locTrigger: z.enum(["on_enter", "on_leave"]),
        radius: z.number().int().positive().optional(),
        notifyUid: z.string().optional(),
      },
    },
    async (args) => run(async () => api.addLocationReminder(args)),
  );

  server.registerTool(
    "update-reminder",
    {
      description: "Update a time-based reminder.",
      inputSchema: {
        id: z.string(),
        type: z.enum(["relative", "absolute"]),
        minuteOffset: z.number().int().optional(),
        due: DueSchema.optional(),
        service: z.enum(["email", "push"]).optional(),
        notifyUid: z.string().optional(),
        isUrgent: z.boolean().optional(),
      },
    },
    async (args) =>
      run(async () => {
        if (args.type === "relative") {
          return api.updateReminder(args.id, {
            reminderType: "relative",
            minuteOffset: args.minuteOffset,
            service: args.service,
            notifyUid: args.notifyUid,
            isUrgent: args.isUrgent,
          });
        }
        return api.updateReminder(args.id, {
          reminderType: "absolute",
          due: args.due,
          service: args.service,
          notifyUid: args.notifyUid,
          isUrgent: args.isUrgent,
        });
      }),
  );

  server.registerTool(
    "delete-reminder",
    {
      description: "Delete a time-based reminder.",
      inputSchema: { id: z.string() },
    },
    async (args) => run(async () => api.deleteReminder(args.id)),
  );

  server.registerTool(
    "delete-location-reminder",
    {
      description: "Delete a location reminder.",
      inputSchema: { id: z.string() },
    },
    async (args) => run(async () => api.deleteLocationReminder(args.id)),
  );
}
