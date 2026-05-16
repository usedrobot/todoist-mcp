import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { TodoistApi } from "@doist/todoist-sdk";

import { registerTaskTools } from "./tasks.js";
import { registerProjectTools } from "./projects.js";
import { registerSectionTools } from "./sections.js";
import { registerLabelTools } from "./labels.js";
import { registerCommentTools } from "./comments.js";
import { registerFilterTools } from "./filters.js";
import { registerReminderTools } from "./reminders.js";
import { registerWorkspaceTools } from "./workspaces.js";
import { registerAnalyticsTools } from "./analytics.js";
import { registerMiscTools } from "./misc.js";

export function registerAllTools(server: McpServer, api: TodoistApi): void {
  registerTaskTools(server, api);
  registerProjectTools(server, api);
  registerSectionTools(server, api);
  registerLabelTools(server, api);
  registerCommentTools(server, api);
  registerFilterTools(server, api);
  registerReminderTools(server, api);
  registerWorkspaceTools(server, api);
  registerAnalyticsTools(server, api);
  registerMiscTools(server, api);
}
