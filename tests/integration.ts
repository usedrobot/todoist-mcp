#!/usr/bin/env tsx
/**
 * End-to-end integration tests for todoist-mcp.
 *
 * Spawns the built MCP server as a child process and exercises every tool
 * through the MCP JSON-RPC protocol over stdio. Creates a sandbox project
 * scoped to this test run and deletes it on teardown.
 *
 * Run: TODOIST_API_TOKEN=<token> npx tsx tests/integration.ts
 */

import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const SERVER_ENTRY = resolve(__dirname, "../dist/index.js");

// ---------- runner ----------

type TestResult = { name: string; status: "pass" | "fail" | "skip"; message?: string; durationMs: number };
const results: TestResult[] = [];

function color(code: number, s: string): string {
  return process.stdout.isTTY ? `\x1b[${code}m${s}\x1b[0m` : s;
}
const GREEN = (s: string) => color(32, s);
const RED = (s: string) => color(31, s);
const YELLOW = (s: string) => color(33, s);
const DIM = (s: string) => color(2, s);

async function step(name: string, fn: () => Promise<void>): Promise<void> {
  const start = Date.now();
  try {
    await fn();
    const durationMs = Date.now() - start;
    results.push({ name, status: "pass", durationMs });
    console.log(`  ${GREEN("✓")} ${name} ${DIM(`(${durationMs}ms)`)}`);
  } catch (err) {
    const durationMs = Date.now() - start;
    const message = err instanceof Error ? err.message : String(err);
    results.push({ name, status: "fail", message, durationMs });
    console.log(`  ${RED("✗")} ${name} ${DIM(`(${durationMs}ms)`)}`);
    console.log(`    ${RED(message)}`);
  }
}

function skip(name: string, reason: string): void {
  results.push({ name, status: "skip", message: reason, durationMs: 0 });
  console.log(`  ${YELLOW("⊘")} ${name} ${DIM(`— ${reason}`)}`);
}

// ---------- MCP client helpers ----------

interface ToolResult {
  isError?: boolean;
  content: Array<{ type: string; text?: string }>;
}

async function call(client: Client, name: string, args: Record<string, unknown> = {}): Promise<unknown> {
  const result = (await client.callTool({ name, arguments: args })) as ToolResult;
  if (result.isError) {
    const text = result.content?.[0]?.text ?? "(no error text)";
    throw new Error(`Tool '${name}' errored: ${text}`);
  }
  const text = result.content?.[0]?.text;
  if (typeof text !== "string") {
    throw new Error(`Tool '${name}' returned non-text content`);
  }
  try {
    return JSON.parse(text);
  } catch {
    return text;
  }
}

function assert(condition: unknown, msg: string): asserts condition {
  if (!condition) throw new Error(msg);
}

// ---------- main ----------

async function main(): Promise<void> {
  const token = process.env.TODOIST_API_TOKEN;
  if (!token) {
    console.error(RED("✗ TODOIST_API_TOKEN env var is required"));
    process.exit(1);
  }

  const transport = new StdioClientTransport({
    command: "node",
    args: [SERVER_ENTRY],
    env: { ...process.env, TODOIST_API_TOKEN: token } as Record<string, string>,
  });

  const client = new Client({ name: "todoist-mcp-tests", version: "0.1.0" }, { capabilities: {} });

  console.log("Connecting to MCP server...");
  await client.connect(transport);

  let sandboxProjectId = "";
  let sandboxSectionId = "";
  let sandboxTaskIds: string[] = [];
  let sandboxLabelId = "";
  let sandboxCommentId = "";
  let sandboxFilterId = "";
  let sandboxReminderId = "";
  let workspaceId = "";
  let myUserId = "";

  try {
    // ===== PHASE 1: meta + setup =====
    console.log("\n" + DIM("── Phase 1: meta + setup ──"));

    await step("tools/list enumerates ~55 tools", async () => {
      const list = await client.listTools();
      assert(list.tools.length >= 50, `expected >=50 tools, got ${list.tools.length}`);
      console.log(DIM(`    server registered ${list.tools.length} tools`));
    });

    await step("user-info returns authenticated user", async () => {
      const user = (await call(client, "user-info")) as { id: string; email: string };
      assert(user.id, "missing user.id");
      assert(user.email, "missing user.email");
      myUserId = user.id;
      console.log(DIM(`    authenticated as ${user.email} (${user.id})`));
    });

    await step("list-workspaces", async () => {
      const ws = (await call(client, "list-workspaces")) as Array<{ id: string; name: string }>;
      if (Array.isArray(ws) && ws.length > 0) {
        workspaceId = ws[0].id;
        console.log(DIM(`    found ${ws.length} workspace(s); using '${ws[0].name}' for tests`));
      } else {
        console.log(DIM("    no workspaces found — workspace-* tests will be skipped"));
      }
    });

    // ===== PHASE 2: read-only against real data =====
    console.log("\n" + DIM("── Phase 2: read-only smokes ──"));

    await step("find-projects returns at least Inbox", async () => {
      const res = (await call(client, "find-projects", { limit: 50 })) as {
        results: Array<{ id: string; name: string }>;
      };
      assert(res.results?.length > 0, "no projects returned");
    });

    await step("find-labels", async () => {
      const res = (await call(client, "find-labels", { limit: 50 })) as { results: unknown[] };
      assert(Array.isArray(res.results), "results is not array");
    });

    await step("find-shared-labels", async () => {
      const res = (await call(client, "find-shared-labels", { limit: 50 })) as { results: unknown[] };
      assert(Array.isArray(res.results), "results is not array");
    });

    await step("find-filters", async () => {
      const res = (await call(client, "find-filters")) as { filters: unknown[] };
      assert(Array.isArray(res.filters), "filters is not array");
    });

    await step("find-reminders", async () => {
      const res = (await call(client, "find-reminders", { limit: 50 })) as { results: unknown[] };
      assert(Array.isArray(res.results), "results is not array");
    });

    await step("find-location-reminders", async () => {
      const res = (await call(client, "find-location-reminders", { limit: 50 })) as {
        results: unknown[];
      };
      assert(Array.isArray(res.results), "results is not array");
    });

    await step("find-tasks with filter query", async () => {
      const res = (await call(client, "find-tasks", { query: "today | overdue", limit: 5 })) as {
        results: unknown[];
      };
      assert(Array.isArray(res.results), "results is not array");
    });

    await step("find-tasks-by-date", async () => {
      const today = new Date().toISOString().slice(0, 10);
      const res = (await call(client, "find-tasks-by-date", { startDate: today, limit: 5 })) as {
        results: unknown[];
      };
      assert(Array.isArray(res.results), "results is not array");
    });

    await step("find-completed-tasks (last 7 days)", async () => {
      const until = new Date().toISOString();
      const since = new Date(Date.now() - 7 * 86400_000).toISOString();
      const res = (await call(client, "find-completed-tasks", {
        by: "completion",
        since,
        until,
        limit: 5,
      })) as { items: unknown[] };
      assert(Array.isArray(res.items), "items is not array");
    });

    await step("get-productivity-stats", async () => {
      const stats = await call(client, "get-productivity-stats");
      assert(stats, "no stats returned");
    });

    await step("find-activity (recent)", async () => {
      const res = (await call(client, "find-activity", { limit: 5 })) as Record<string, unknown>;
      assert(res, "no result");
    });

    await step("get-backups", async () => {
      const backups = await call(client, "get-backups");
      assert(Array.isArray(backups), "backups not array");
    });

    await step("search (OpenAI MCP shape)", async () => {
      const res = (await call(client, "search", { query: "today", limit: 5 })) as {
        results: unknown[];
      };
      assert(Array.isArray(res.results), "results is not array");
    });

    // ===== PHASE 3: sandbox project =====
    console.log("\n" + DIM("── Phase 3: sandbox project lifecycle ──"));

    const sandboxName = `MCP Test Sandbox ${new Date().toISOString().replace(/[:.]/g, "-")}`;

    await step("add-projects (create sandbox)", async () => {
      const res = (await call(client, "add-projects", {
        projects: [{ name: sandboxName }],
      })) as { created: Array<{ id: string; name: string }> };
      assert(res.created?.[0]?.id, "no project id returned");
      sandboxProjectId = res.created[0].id;
      console.log(DIM(`    sandbox project id = ${sandboxProjectId}`));
    });

    await step("get-project (sandbox)", async () => {
      const p = (await call(client, "get-project", { id: sandboxProjectId })) as { id: string };
      assert(p.id === sandboxProjectId, "id mismatch");
    });

    await step("search-projects finds existing Inbox", async () => {
      // Search indexing has multi-minute lag for newly created projects, so we exercise the
      // tool against a stable existing project name. This still validates the tool wiring;
      // a fresh sandbox project won't show up immediately.
      const res = (await call(client, "search-projects", { query: "Inbox" })) as {
        results: Array<{ name: string }>;
      };
      assert(
        res.results?.some((p) => p.name.toLowerCase().includes("inbox")),
        `expected Inbox in results, got ${res.results?.map((p) => p.name).join(", ")}`,
      );
    });

    await step("update-projects (rename)", async () => {
      const res = (await call(client, "update-projects", {
        projects: [{ id: sandboxProjectId, name: `${sandboxName} (renamed)` }],
      })) as { updated: Array<{ name: string }> };
      assert(res.updated?.[0]?.name?.includes("renamed"), "rename did not apply");
    });

    await step("find-project-collaborators (empty on personal)", async () => {
      const res = (await call(client, "find-project-collaborators", {
        projectId: sandboxProjectId,
      })) as { results: unknown[] };
      assert(Array.isArray(res.results), "results not array");
    });

    await step("get-archived-projects", async () => {
      const res = (await call(client, "get-archived-projects", { limit: 5 })) as {
        results: unknown[];
      };
      assert(Array.isArray(res.results), "results not array");
    });

    // ===== PHASE 4: sections =====
    console.log("\n" + DIM("── Phase 4: section lifecycle ──"));

    await step("add-sections", async () => {
      const res = (await call(client, "add-sections", {
        sections: [{ name: "Test section", projectId: sandboxProjectId }],
      })) as { created: Array<{ id: string }> };
      sandboxSectionId = res.created[0].id;
    });

    await step("find-sections (in sandbox)", async () => {
      const res = (await call(client, "find-sections", { projectId: sandboxProjectId })) as {
        results: Array<{ id: string }>;
      };
      assert(res.results?.some((s) => s.id === sandboxSectionId), "section not found");
    });

    await step("get-section", async () => {
      const s = (await call(client, "get-section", { id: sandboxSectionId })) as { id: string };
      assert(s.id === sandboxSectionId, "id mismatch");
    });

    await step("update-sections (rename)", async () => {
      const res = (await call(client, "update-sections", {
        sections: [{ id: sandboxSectionId, name: "Test section (renamed)" }],
      })) as { updated: Array<{ name: string }> };
      assert(res.updated?.[0]?.name?.includes("renamed"), "rename did not apply");
    });

    // ===== PHASE 5: tasks =====
    console.log("\n" + DIM("── Phase 5: task lifecycle ──"));

    await step("add-tasks (3 tasks, varied)", async () => {
      // Reminders require a due *time*, not just a date. Use dueDatetime for task 2 so it can
      // host a reminder later.
      const tomorrow = new Date(Date.now() + 86400_000);
      const tomorrowAt9am = new Date(
        tomorrow.getFullYear(),
        tomorrow.getMonth(),
        tomorrow.getDate(),
        9,
        0,
        0,
      ).toISOString();
      const res = (await call(client, "add-tasks", {
        tasks: [
          { content: "Test task 1 (p1)", projectId: sandboxProjectId, priority: "p1" },
          {
            content: "Test task 2 (due tomorrow 9am)",
            projectId: sandboxProjectId,
            dueDatetime: tomorrowAt9am,
          },
          {
            content: "Test task 3 (labeled)",
            projectId: sandboxProjectId,
            labels: ["mcp-test-label-tmp"],
          },
        ],
      })) as { created: Array<{ id: string; priority: number }> };
      assert(res.created.length === 3, "wrong number created");
      // Priority translation check: p1 → REST priority 4
      assert(res.created[0].priority === 4, `p1 should be REST priority 4, got ${res.created[0].priority}`);
      sandboxTaskIds = res.created.map((t) => t.id);
    });

    await step("find-tasks in sandbox project", async () => {
      const res = (await call(client, "find-tasks", { projectId: sandboxProjectId })) as {
        results: Array<{ id: string }>;
      };
      assert(res.results?.length >= 3, `expected >=3 tasks, got ${res.results?.length}`);
    });

    await step("find-tasks by ids", async () => {
      const res = (await call(client, "find-tasks", { ids: [sandboxTaskIds[0]] })) as {
        results: unknown[];
      };
      assert(res.results?.length === 1, "expected 1 task by id");
    });

    await step("update-tasks (content + priority p3)", async () => {
      const res = (await call(client, "update-tasks", {
        tasks: [{ id: sandboxTaskIds[0], content: "Test task 1 (updated)", priority: "p3" }],
      })) as { updated: Array<{ content: string; priority: number }> };
      assert(res.updated[0].content.includes("updated"), "content did not update");
      assert(res.updated[0].priority === 2, `p3 should be REST priority 2, got ${res.updated[0].priority}`);
    });

    await step("reschedule-tasks (dueDatetime)", async () => {
      const target = new Date(Date.now() + 7 * 86400_000);
      const targetDt = new Date(
        target.getFullYear(),
        target.getMonth(),
        target.getDate(),
        9,
        0,
        0,
      ).toISOString();
      const res = (await call(client, "reschedule-tasks", {
        tasks: [{ id: sandboxTaskIds[1], dueDatetime: targetDt }],
      })) as { rescheduled: Array<{ due?: { date: string } }> };
      assert(res.rescheduled[0].due?.date, `due not set: ${JSON.stringify(res.rescheduled[0].due)}`);
    });

    await step("quick-add-task", async () => {
      const res = (await call(client, "quick-add-task", {
        text: `Quick test task #${sandboxProjectId} p2`,
      })) as { id: string };
      assert(res.id, "no id returned");
      sandboxTaskIds.push(res.id);
    });

    await step("move-tasks (into section)", async () => {
      const res = (await call(client, "move-tasks", {
        ids: [sandboxTaskIds[0]],
        sectionId: sandboxSectionId,
      })) as Array<{ id: string; sectionId: string }>;
      assert(res[0].sectionId === sandboxSectionId, "section not applied");
    });

    await step("complete-tasks", async () => {
      const res = (await call(client, "complete-tasks", { ids: [sandboxTaskIds[2]] })) as {
        results: Array<{ status: string }>;
      };
      assert(res.results[0].status === "completed", "status wrong");
    });

    await step("uncomplete-tasks", async () => {
      const res = (await call(client, "uncomplete-tasks", { ids: [sandboxTaskIds[2]] })) as {
        results: Array<{ status: string }>;
      };
      assert(res.results[0].status === "reopened", "status wrong");
    });

    // ===== PHASE 6: comments =====
    console.log("\n" + DIM("── Phase 6: comment lifecycle ──"));

    await step("add-comments (on a task)", async () => {
      const res = (await call(client, "add-comments", {
        comments: [{ content: "Test comment from MCP integration test", taskId: sandboxTaskIds[0] }],
      })) as { created: Array<{ id: string }> };
      sandboxCommentId = res.created[0].id;
    });

    await step("find-comments (on the task)", async () => {
      const res = (await call(client, "find-comments", { taskId: sandboxTaskIds[0] })) as {
        results: Array<{ id: string }>;
      };
      assert(res.results?.some((c) => c.id === sandboxCommentId), "comment not found");
    });

    await step("get-comment", async () => {
      const c = (await call(client, "get-comment", { id: sandboxCommentId })) as { id: string };
      assert(c.id === sandboxCommentId, "id mismatch");
    });

    await step("update-comments", async () => {
      const res = (await call(client, "update-comments", {
        comments: [{ id: sandboxCommentId, content: "Test comment (updated)" }],
      })) as { updated: Array<{ content: string }> };
      assert(res.updated[0].content.includes("updated"), "content did not update");
    });

    await step("delete-comments", async () => {
      const res = (await call(client, "delete-comments", { ids: [sandboxCommentId] })) as {
        results: Array<{ status: string }>;
      };
      assert(res.results[0].status === "deleted", "status wrong");
    });

    // ===== PHASE 7: labels =====
    console.log("\n" + DIM("── Phase 7: label lifecycle ──"));

    const tmpLabelName = `mcp-test-${Date.now()}`;

    await step("add-labels", async () => {
      const res = (await call(client, "add-labels", {
        labels: [{ name: tmpLabelName, color: "berry_red" }],
      })) as { created: Array<{ id: string; name: string }> };
      sandboxLabelId = res.created[0].id;
    });

    await step("find-labels finds new label", async () => {
      const res = (await call(client, "find-labels", { limit: 200 })) as {
        results: Array<{ id: string }>;
      };
      assert(res.results?.some((l) => l.id === sandboxLabelId), "label not found");
    });

    await step("get-label", async () => {
      const l = (await call(client, "get-label", { id: sandboxLabelId })) as { id: string };
      assert(l.id === sandboxLabelId, "id mismatch");
    });

    await step("update-labels", async () => {
      const res = (await call(client, "update-labels", {
        labels: [{ id: sandboxLabelId, color: "sky_blue" }],
      })) as { updated: Array<{ color: string }> };
      assert(res.updated[0].color === "sky_blue", "color did not update");
    });

    await step("delete-labels", async () => {
      const res = (await call(client, "delete-labels", { ids: [sandboxLabelId] })) as {
        results: Array<{ status: string }>;
      };
      assert(res.results[0].status === "deleted", "status wrong");
    });

    skip("rename-shared-label", "destructive on real shared labels — skipped");
    skip("remove-shared-label", "destructive on real shared labels — skipped");

    // ===== PHASE 8: filters =====
    console.log("\n" + DIM("── Phase 8: filter lifecycle ──"));

    const tmpFilterName = `mcp-test-filter-${Date.now()}`;

    await step("add-filters", async () => {
      const res = (await call(client, "add-filters", {
        filters: [{ name: tmpFilterName, query: "@mcp-test", color: "olive_green" }],
      })) as { created: Array<{ id: string }>; tempIdMapping: Record<string, string> };
      assert(res.created?.[0]?.id, `no filter id; got: ${JSON.stringify(res)}`);
      sandboxFilterId = res.created[0].id;
    });

    await step("find-filters includes new filter", async () => {
      const res = (await call(client, "find-filters")) as { filters: Array<{ id: string }> };
      assert(res.filters?.some((f) => f.id === sandboxFilterId), "filter not found");
    });

    await step("update-filters", async () => {
      const res = (await call(client, "update-filters", {
        filters: [{ id: sandboxFilterId, name: `${tmpFilterName}-renamed` }],
      })) as { syncStatus: Record<string, unknown> };
      assert(res.syncStatus, "no sync status");
    });

    await step("delete-filters", async () => {
      const res = (await call(client, "delete-filters", { ids: [sandboxFilterId] })) as {
        syncStatus: Record<string, unknown>;
      };
      assert(res.syncStatus, "no sync status");
      sandboxFilterId = "";
    });

    // ===== PHASE 9: reminders =====
    console.log("\n" + DIM("── Phase 9: reminder lifecycle ──"));

    await step("add-reminder (relative)", async () => {
      const reminder = (await call(client, "add-reminder", {
        taskId: sandboxTaskIds[1],
        type: "relative",
        minuteOffset: 30,
      })) as { id: string };
      assert(reminder.id, "no reminder id");
      sandboxReminderId = reminder.id;
    });

    await step("find-reminders includes new reminder", async () => {
      const res = (await call(client, "find-reminders", { taskId: sandboxTaskIds[1] })) as {
        results: Array<{ id: string }>;
      };
      assert(res.results?.some((r) => r.id === sandboxReminderId), "reminder not found");
    });

    await step("update-reminder", async () => {
      const updated = (await call(client, "update-reminder", {
        id: sandboxReminderId,
        type: "relative",
        minuteOffset: 60,
      })) as { id: string; minuteOffset?: number };
      assert(updated.id === sandboxReminderId, "id mismatch");
    });

    await step("delete-reminder", async () => {
      await call(client, "delete-reminder", { id: sandboxReminderId });
      sandboxReminderId = "";
    });

    skip("add-location-reminder / delete-location-reminder", "requires GPS coords + paid plan; skipped");

    // ===== PHASE 10: analytics (workspace-only) =====
    console.log("\n" + DIM("── Phase 10: project analytics (workspace-only API) ──"));

    if (workspaceId) {
      // Need a workspace-scoped project to exercise these. We test against the user's first
      // workspace project rather than the personal sandbox.
      let workspaceProjectId = "";
      try {
        const wp = (await call(client, "find-workspace-projects", {
          workspaceId,
          limit: 1,
        })) as { results: Array<{ id: string }> };
        workspaceProjectId = wp.results?.[0]?.id ?? "";
      } catch {
        /* leave empty */
      }

      if (workspaceProjectId) {
        await step("get-project-activity-stats", async () =>
          void assert(await call(client, "get-project-activity-stats", { projectId: workspaceProjectId }), "no stats"),
        );
        await step("get-project-health", async () =>
          void assert(await call(client, "get-project-health", { projectId: workspaceProjectId }), "no health"),
        );
        await step("get-project-health-context", async () =>
          void assert(await call(client, "get-project-health-context", { projectId: workspaceProjectId }), "no context"),
        );
        await step("get-project-progress", async () =>
          void assert(await call(client, "get-project-progress", { projectId: workspaceProjectId }), "no progress"),
        );
      } else {
        skip("get-project-activity-stats", "no workspace project to exercise against");
        skip("get-project-health", "no workspace project to exercise against");
        skip("get-project-health-context", "no workspace project to exercise against");
        skip("get-project-progress", "no workspace project to exercise against");
      }
    } else {
      skip("get-project-activity-stats", "workspace-only API; account has no workspace");
      skip("get-project-health", "workspace-only API; account has no workspace");
      skip("get-project-health-context", "workspace-only API; account has no workspace");
      skip("get-project-progress", "workspace-only API; account has no workspace");
    }

    // ===== PHASE 11: workspace ops =====
    console.log("\n" + DIM("── Phase 11: workspace ops ──"));

    if (workspaceId) {
      await step("get-workspace", async () => {
        const w = (await call(client, "get-workspace", { id: workspaceId })) as { id: string };
        assert(w.id === workspaceId, "id mismatch");
      });

      await step("find-workspace-users", async () => {
        const res = (await call(client, "find-workspace-users", { workspaceId })) as {
          results: unknown[];
        };
        assert(Array.isArray(res.results), "results not array");
      });

      await step("find-workspace-projects", async () => {
        const res = (await call(client, "find-workspace-projects", { workspaceId })) as {
          results: unknown[];
        };
        assert(Array.isArray(res.results), "results not array");
      });

      await step("find-workspace-user-tasks (self)", async () => {
        const res = (await call(client, "find-workspace-user-tasks", {
          workspaceId,
          userId: myUserId,
        })) as { tasks: unknown[] };
        assert(Array.isArray(res.tasks), "tasks not array");
      });

      await step("get-workspace-insights", async () => {
        const r = await call(client, "get-workspace-insights", { workspaceId });
        assert(r, "no insights");
      });

      await step("find-workspace-members-activity", async () => {
        const r = await call(client, "find-workspace-members-activity", { workspaceId });
        assert(r, "no activity");
      });
    } else {
      skip("get-workspace", "no workspace available");
      skip("find-workspace-users", "no workspace available");
      skip("find-workspace-projects", "no workspace available");
      skip("find-workspace-user-tasks", "no workspace available");
      skip("get-workspace-insights", "no workspace available");
      skip("find-workspace-members-activity", "no workspace available");
    }

    // ===== PHASE 12: fetch tool (covers all entity types) =====
    console.log("\n" + DIM("── Phase 12: fetch tool ──"));

    await step("fetch type=task", async () => {
      const t = (await call(client, "fetch", { type: "task", id: sandboxTaskIds[0] })) as {
        id: string;
      };
      assert(t.id === sandboxTaskIds[0], "id mismatch");
    });

    await step("fetch type=project", async () => {
      const p = (await call(client, "fetch", { type: "project", id: sandboxProjectId })) as {
        id: string;
      };
      assert(p.id === sandboxProjectId, "id mismatch");
    });

    await step("fetch type=section", async () => {
      const s = (await call(client, "fetch", { type: "section", id: sandboxSectionId })) as {
        id: string;
      };
      assert(s.id === sandboxSectionId, "id mismatch");
    });

    skip("upload-file", "not exercising file upload in tests");

    // ===== PHASE 13: cleanup destructive task ops =====
    console.log("\n" + DIM("── Phase 13: cleanup (destructive task ops) ──"));

    await step("delete-tasks (subset)", async () => {
      const res = (await call(client, "delete-tasks", { ids: [sandboxTaskIds[2]] })) as {
        results: Array<{ status: string }>;
      };
      assert(res.results[0].status === "deleted", "status wrong");
    });

    await step("delete-sections", async () => {
      const res = (await call(client, "delete-sections", { ids: [sandboxSectionId] })) as {
        results: Array<{ status: string }>;
      };
      assert(res.results[0].status === "deleted", "status wrong");
    });
  } finally {
    // ===== TEARDOWN =====
    console.log("\n" + DIM("── Teardown ──"));

    if (sandboxProjectId) {
      try {
        await call(client, "delete-projects", { ids: [sandboxProjectId] });
        console.log(`  ${GREEN("✓")} sandbox project deleted`);
      } catch (err) {
        console.log(`  ${RED("✗")} sandbox cleanup failed: ${err instanceof Error ? err.message : err}`);
      }
    }
    if (sandboxFilterId) {
      try {
        await call(client, "delete-filters", { ids: [sandboxFilterId] });
        console.log(`  ${GREEN("✓")} sandbox filter deleted`);
      } catch {
        // best effort
      }
    }
    await client.close();
  }

  // ===== SUMMARY =====
  const passed = results.filter((r) => r.status === "pass").length;
  const failed = results.filter((r) => r.status === "fail").length;
  const skipped = results.filter((r) => r.status === "skip").length;

  console.log("\n" + DIM("══════════════════════════════════════"));
  console.log(
    `  ${GREEN(`${passed} passed`)}  ${failed > 0 ? RED(`${failed} failed`) : DIM("0 failed")}  ${YELLOW(`${skipped} skipped`)}`,
  );
  console.log(DIM("══════════════════════════════════════"));

  if (failed > 0) {
    console.log("\n" + RED("Failures:"));
    for (const r of results.filter((r) => r.status === "fail")) {
      console.log(`  ${RED("✗")} ${r.name}`);
      console.log(`    ${DIM(r.message ?? "")}`);
    }
    process.exit(1);
  }
}

main().catch((err) => {
  console.error(RED("\n✗ Fatal:"), err);
  process.exit(1);
});
