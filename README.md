# todoist-mcp

An MCP server for [Todoist](https://todoist.com) that uses a **personal API token** over **stdio** — no OAuth flow, no reauthentication, no expiring credentials. Drop it in, set one environment variable, and your AI client has full access to Todoist.

Covers ~55 tools across the entire Todoist API surface: tasks, projects, sections, labels, comments, filters, reminders, workspaces, analytics, activity log, and more. Wraps the official [`@doist/todoist-sdk`](https://www.npmjs.com/package/@doist/todoist-sdk) (v10+) which covers both the REST v1 and Sync APIs.

## Why another Todoist MCP?

The official Doist server uses browser-based OAuth, which times out hourly. The popular `todoist-mcp` package (stanislavlysenko0912) is stdio + token, but doesn't cover filters, reminders, or analytics endpoints. This one covers everything, with one configuration that doesn't churn.

| Feature | Doist official | stanislavlysenko0912 | **todoist-mcp** |
|---|---|---|---|
| Transport | HTTP / OAuth | stdio / token | **stdio / token** |
| Reauth needed | Hourly | Never | **Never** |
| Tasks / Projects / Sections / Labels / Comments | ✅ | ✅ | ✅ |
| Filters | ✅ | ❌ | ✅ |
| Reminders (time + location) | ✅ | ❌ | ✅ |
| Productivity stats | ✅ | ❌ | ✅ |
| Project health + insights | ✅ | ❌ | ✅ |
| Workspace insights | ✅ | ❌ | ✅ |
| Activity log | ✅ | ❌ | ✅ |
| File uploads | ✅ | ❌ | ✅ |

## Install

Requires Node.js 20+. Not on npm yet — clone and build locally:

```bash
git clone https://github.com/usedrobot/todoist-mcp
cd todoist-mcp
npm install
npm run build
```

The built entry point lives at `dist/index.js`. Point your MCP client at that.

## Get your API token

1. Open Todoist in a browser.
2. Settings → Integrations → Developer.
3. Copy the **API token**.
4. Treat it like a password — it grants full account access.

## Configure your MCP client

Replace `/absolute/path/to/todoist-mcp` below with wherever you cloned the repo.

### Claude Code

```bash
claude mcp add -s user todoist \
  --env TODOIST_API_TOKEN=<your_token> \
  -- node /absolute/path/to/todoist-mcp/dist/index.js
```

### Claude Desktop

`~/Library/Application Support/Claude/claude_desktop_config.json`:

```json
{
  "mcpServers": {
    "todoist": {
      "command": "node",
      "args": ["/absolute/path/to/todoist-mcp/dist/index.js"],
      "env": { "TODOIST_API_TOKEN": "<your_token>" }
    }
  }
}
```

### Cursor

`.cursor/mcp.json`:

```json
{
  "mcpServers": {
    "todoist": {
      "command": "node",
      "args": ["/absolute/path/to/todoist-mcp/dist/index.js"],
      "env": { "TODOIST_API_TOKEN": "<your_token>" }
    }
  }
}
```

## Tools

### Tasks

- `find-tasks` — list by project/section/label or by Todoist filter query
- `find-tasks-by-date` — list by due-date range
- `find-completed-tasks` — by completion date or due date
- `add-tasks` — create (up to 25 per call)
- `update-tasks` — patch (use `reschedule-tasks` for recurring task dates)
- `reschedule-tasks` — recurrence-safe date change
- `complete-tasks` / `uncomplete-tasks` / `delete-tasks`
- `move-tasks` — to a different project / section / parent
- `quick-add-task` — natural-language input (`"Buy milk tomorrow @errands #Home p1"`)

### Projects

- `find-projects` / `search-projects` / `get-project` / `get-archived-projects`
- `add-projects` / `update-projects` / `delete-projects`
- `move-project` (between workspace ↔ personal)
- `find-project-collaborators`

### Sections, Labels, Comments

CRUD for each, plus `find-shared-labels`, `rename-shared-label`, `remove-shared-label`.

### Filters (Sync API)

- `find-filters` / `add-filters` / `update-filters` / `delete-filters`

### Reminders

- `find-reminders` / `find-location-reminders`
- `add-reminder` (relative or absolute time)
- `add-location-reminder`
- `update-reminder` / `delete-reminder` / `delete-location-reminder`

### Workspaces

- `list-workspaces` / `get-workspace`
- `find-workspace-users` / `find-workspace-projects` / `find-workspace-user-tasks`

### Analytics

- `get-productivity-stats` — karma + streaks
- `get-project-activity-stats` — event counts over N weeks
- `get-project-health` / `get-project-health-context` / `get-project-progress`
- `get-workspace-insights`
- `find-workspace-members-activity`

### Other

- `user-info` — current user account
- `find-activity` — activity log search
- `search` / `fetch` — OpenAI MCP-compatible
- `upload-file` — for use as a comment attachment
- `get-backups`

## Priority semantics

This server matches Todoist's UI convention: `p1` is the highest priority, `p4` is the default (lowest). This is the **inverse** of the REST API's integer convention (1 = lowest, 4 = highest), which we translate internally. Pass priorities as strings: `"p1"`, `"p2"`, `"p3"`, `"p4"`.

## Recurrence safety

For recurring tasks, **always use `reschedule-tasks`** rather than `update-tasks` to change the due date. `reschedule-tasks` uses `dueDate` / `dueDatetime` which moves only the next occurrence — `update-tasks` accepts `dueString` which would overwrite the recurrence pattern.

## Development

```bash
git clone https://github.com/usedrobot/todoist-mcp
cd todoist-mcp
npm install
npm run build
TODOIST_API_TOKEN=<your_token> npm start
```

Hot-reload during development:

```bash
TODOIST_API_TOKEN=<your_token> npm run dev
```

### Testing

The repo ships with an end-to-end integration suite (`tests/integration.ts`) that spawns the built server, connects via the MCP client SDK over stdio, and exercises every tool against your real Todoist account. It creates a sandbox project for writes and deletes it on teardown.

```bash
TODOIST_API_TOKEN=<your_token> npm test
```

Expected on a non-workspace (personal Pro) account: ~58 pass, 0 fail, ~14 skipped. The skips are environmental: workspace-only tools require a Todoist Business plan, shared-label and location-reminder writes are destructive on real data so they're intentionally not exercised, and file uploads are not part of the suite.

## License

MIT — see [LICENSE](./LICENSE).
