#!/usr/bin/env node
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { TodoistApi } from "@doist/todoist-sdk";
import { registerAllTools } from "./tools/index.js";

const SERVER_NAME = "todoist-mcp";
const SERVER_VERSION = "0.1.0";

async function main(): Promise<void> {
  const token = process.env.TODOIST_API_TOKEN ?? process.env.API_KEY;
  if (!token) {
    console.error(
      "todoist-mcp: TODOIST_API_TOKEN (or API_KEY) env var is required. " +
        "Get a personal token at https://todoist.com/app/settings/integrations/developer",
    );
    process.exit(1);
  }

  const api = new TodoistApi(token);
  const server = new McpServer({ name: SERVER_NAME, version: SERVER_VERSION });

  registerAllTools(server, api);

  const transport = new StdioServerTransport();
  await server.connect(transport);
  // stdio transport keeps the process alive
}

main().catch((err) => {
  console.error("todoist-mcp: fatal", err);
  process.exit(1);
});
