/**
 * @fileoverview
 * Piyaz plugin for Cline.
 *
 * Wraps the Piyaz MCP server (streamable HTTP at /api/mcp) as Cline tools so
 * a Cline agent can plan, track, and resume work in Piyaz: search tasks, read
 * tasks and projects, list the workspace, map the dependency graph, create and
 * edit tasks, link tasks, read the activity feed, and manage notes.
 *
 * Two ways to load (see https://docs.cline.bot/sdk/guides/writing-plugins):
 *
 *  1. File plugin (single file; only Node builtins and @cline/* imports):
 *      import { ClineCore } from "@cline/sdk"
 *      const cline = await ClineCore.create({ clientName: "my-app" })
 *      await cline.start({
 *        config: { ..., pluginPaths: ["/abs/path/to/cline-plugin.ts"] },
 *      })
 *
 *  2. Package plugin:
 *      cline plugin install /abs/path/to/plugins/cline
 *     Configuration is read from PIYAZ_SERVER_URL and PIYAZ_ACCESS_TOKEN env vars.
 *
 * Configuration is passed to createPiyazPlugin({ serverUrl, accessToken }).
 */

// createTool is provided by @cline/sdk at runtime inside Cline.
// Locally we define it as an identity so this module loads without
// the SDK package being resolvable (the CLI installer strips node_modules).
function createTool<T extends { name: string; description: string; inputSchema: unknown; execute: unknown }>(tool: T): T {
  return tool;
}

export interface PiyazPluginConfig {
  /** Base URL of the Piyaz MCP server, e.g. "https://app.piyaz.ai". */
  serverUrl: string;
  /** OAuth bearer access token for the Piyaz MCP server, if auth is required. */
  accessToken?: string;
}

interface JsonRpcEnvelope {
  result?: unknown;
  error?: { code: number; message: string; data?: unknown };
}

function endpoint(config: PiyazPluginConfig): string {
  return config.serverUrl.replace(/\/+$/, "") + "/api/mcp";
}

/** Call one tool on the Piyaz MCP server over streamable HTTP. */
async function piyazCall(
  config: PiyazPluginConfig,
  name: string,
  arguments_: Record<string, unknown>,
): Promise<unknown> {
  const response = await fetch(endpoint(config), {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...(config.accessToken ? { Authorization: `Bearer ${config.accessToken}` } : {}),
    },
    body: JSON.stringify({
      jsonrpc: "2.0",
      id: crypto.randomUUID(),
      method: "tools/call",
      params: { name, arguments: arguments_ },
    }),
  });
  if (!response.ok) {
    throw new Error(`Piyaz MCP ${name}: HTTP ${response.status} ${response.statusText}`);
  }
  const envelope: JsonRpcEnvelope = await response.json();
  if (envelope.error) {
    throw new Error(`Piyaz MCP ${name}: ${envelope.error.message}`);
  }
  return envelope.result ?? null;
}

/** Shape of a Cline hook context (matches @cline/sdk). */
interface HookContext {
  toolCall?: { name: string; input?: unknown };
  input?: unknown;
  result?: { usage?: { inputTokens?: number; outputTokens?: number } };
}

/** Build every Piyaz tool backed by the MCP server. */
function createPiyazTools(config: PiyazPluginConfig) {
  return [
    createTool({
      name: "piyaz_search",
      description:
        "Find tasks across Piyaz projects. Cross-project by default; pass project to scope. " +
        "At least one criterion is required. Returns a keyset-paginated page; pass cursor for the next page.",
      inputSchema: {
        type: "object",
        properties: {
          query: {
            type: "string",
            description: "Free text matched against task titles and descriptions.",
          },
          project: {
            type: "string",
            description: "Project identifier (e.g. WYN) or UUID to scope the search.",
          },
          status: {
            type: "array",
            items: { type: "string" },
            description: "Task statuses to include (draft, planned, in_progress, in_review, done, cancelled).",
          },
          priority: {
            type: "array",
            items: { type: "string" },
            description: "Priority values to include.",
          },
          assignee: {
            type: "string",
            description: "Assignee user id to filter by.",
          },
          category: {
            type: "string",
            description: "Task category to filter by.",
          },
          tags: {
            type: "array",
            items: { type: "string" },
            description: "Tags to filter by.",
          },
          limit: {
            type: "number",
            description: "Maximum results. Default 10, capped by the server.",
          },
          cursor: {
            type: "string",
            description: "Keyset cursor for the next page.",
          },
        },
      },
      execute: async (input: Record<string, unknown>) =>
        piyazCall(config, "piyaz_search", input),
    }),
    createTool({
      name: "piyaz_get",
      description:
        "Read one task (by task ref like WYN-42 or UUID) or one project. " +
        "Pass exactly one of task or project. Use lens to pick a read shape " +
        "(summary, working, agent, planning, review, record) or fields=[...] for a slim raw read.",
      inputSchema: {
        type: "object",
        properties: {
          task: {
            type: "string",
            description: "Task ref (e.g. WYN-42) or UUID. Mutually exclusive with project.",
          },
          project: {
            type: "string",
            description: "Project identifier (e.g. WYN) or UUID. Mutually exclusive with task.",
          },
          lens: {
            type: "string",
            enum: ["summary", "working", "agent", "planning", "review", "record"],
            description: "Task read shape. Default working.",
          },
          view: {
            type: "string",
            enum: ["meta", "overview"],
            description: "Project read shape. Default meta.",
          },
          fields: {
            type: "array",
            items: { type: "string" },
            description: "Raw task fields to read (slim read with updatedAt for ifUpdatedAt).",
          },
          detail: {
            type: "string",
            enum: ["concise", "detailed"],
            description: "Overview detail level.",
          },
          limit: {
            type: "number",
            description: "Row cap for overview.",
          },
        },
      },
      execute: async (input: Record<string, unknown>) => piyazCall(config, "piyaz_get", input),
    }),
    createTool({
      name: "piyaz_workspace",
      description:
        "Session-start surface: caller identity (whoami), team memberships, " +
        "member directory, and project list/create/update plus category edits.",
      inputSchema: {
        type: "object",
        required: ["action"],
        properties: {
          action: {
            type: "string",
            enum: [
              "whoami", "teams", "projects", "members",
              "create", "update", "rename_category", "delete_category",
            ],
            description: "Workspace action.",
          },
          project: { type: "string", description: "Project identifier or UUID." },
          title: { type: "string", description: "Project title (create/update)." },
          description: { type: "string", description: "Project description (create/update)." },
          status: {
            type: "string",
            enum: ["brainstorming", "decomposing", "active", "archived"],
            description: "Project status (update).",
          },
          categories: {
            type: "array",
            items: { type: "string" },
            description: "Project categories (update).",
          },
          identifier: { type: "string", description: "Project identifier (create/rename)." },
        },
      },
      execute: async (input: Record<string, unknown>) =>
        piyazCall(config, "piyaz_workspace", input),
    }),
    createTool({
      name: "piyaz_map",
      description:
        "Graph navigation: project-scoped work queues (ready, blocked, plannable, critical_path) " +
        "and task-scoped walks (downstream, neighbors).",
      inputSchema: {
        type: "object",
        required: ["view"],
        properties: {
          view: {
            type: "string",
            enum: ["ready", "blocked", "plannable", "critical_path", "downstream", "neighbors"],
            description: "Map view. downstream/neighbors require task; the rest require project.",
          },
          project: {
            type: "string",
            description: "Project identifier (e.g. WYN) or UUID.",
          },
          task: {
            type: "string",
            description: "Task ref (e.g. WYN-42) or UUID.",
          },
          hops: {
            type: "number",
            description: "Neighbor walk hops (1 or 2). Default 1.",
          },
          limit: {
            type: "number",
            description: "Row cap. Default 50.",
          },
        },
      },
      execute: async (input: Record<string, unknown>) => piyazCall(config, "piyaz_map", input),
    }),
    createTool({
      name: "piyaz_create",
      description:
        "Idempotent batch task creation in one project with internal edges. " +
        "Pass items keyed so restarted runs never duplicate a task set.",
      inputSchema: {
        type: "object",
        required: ["project", "items"],
        properties: {
          project: {
            type: "string",
            description: "Project identifier (e.g. WYN) or UUID.",
          },
          items: {
            type: "array",
            items: {
              type: "object",
              required: ["title", "description"],
              properties: {
                key: { type: "string", description: "Stable dedup key for this item." },
                title: { type: "string", description: "Task title (verb + noun, imperative)." },
                description: {
                  type: "string",
                  description: "Task description, enough to start the work.",
                },
                status: {
                  type: "string",
                  enum: ["draft", "planned", "in_progress", "in_review", "done", "cancelled"],
                  description: "Initial status. Default draft.",
                },
                acceptanceCriteria: {
                  type: "array",
                  items: { type: "string" },
                  description: "Acceptance criteria lines.",
                },
                decisions: { type: "array", items: { type: "string" }, description: "Decision texts." },
                tags: { type: "array", items: { type: "string" }, description: "Tags." },
                category: { type: "string", description: "Task category." },
                priority: { type: "string", description: "Priority." },
                estimate: { type: "string", description: "Estimate." },
                assigneeIds: { type: "array", items: { type: "string" }, description: "Assignee user ids." },
                files: { type: "array", items: { type: "string" }, description: "File paths." },
                implementationPlan: { type: "string", description: "Implementation plan." },
                executionRecord: { type: "string", description: "Execution record." },
                prUrl: { type: "string", description: "PR URL." },
              },
            },
            description: "Task items to create.",
          },
          edges: {
            type: "array",
            items: {
              type: "object",
              required: ["source", "target", "type", "note"],
              properties: {
                source: { type: "string", description: "Source task key or ref." },
                target: { type: "string", description: "Target task key or ref." },
                type: {
                  type: "string",
                  enum: ["depends_on", "relates_to"],
                  description: "Edge type.",
                },
                note: { type: "string", description: "Substantive edge note (no placeholders)." },
              },
            },
            description: "Dependency/relationship edges between items.",
          },
        },
      },
      execute: async (input: Record<string, unknown>) =>
        piyazCall(config, "piyaz_create", input),
    }),
    createTool({
      name: "piyaz_edit",
      description:
        "Ordered, atomic operation list against one task. Pass the task ref " +
        "(or UUID), the ifUpdatedAt from your last read for compare-and-swap, " +
        "and the operations to apply.",
      inputSchema: {
        type: "object",
        required: ["task", "operations"],
        properties: {
          task: {
            type: "string",
            description: "Task ref (e.g. WYN-42) or UUID.",
          },
          ifUpdatedAt: {
            type: "string",
            description: "updatedAt from piyaz_get fields=..., for compare-and-swap.",
          },
          operations: {
            type: "array",
            items: {
              type: "object",
              description: "Edit operation (set/replace/insert/remove on task fields and collections).",
            },
            description: "Operations to apply in order.",
          },
        },
      },
      execute: async (input: Record<string, unknown>) => piyazCall(config, "piyaz_edit", input),
    }),
    createTool({
      name: "piyaz_link",
      description:
        "Create, update, or remove a dependency/relationship edge between two " +
        "ref-addressed tasks. The edge note must be substantive (no placeholders).",
      inputSchema: {
        type: "object",
        required: ["action"],
        properties: {
          action: {
            type: "string",
            enum: ["create", "update", "remove"],
            description: "Link action.",
          },
          source: { type: "string", description: "Source task ref or UUID." },
          target: { type: "string", description: "Target task ref or UUID." },
          type: {
            type: "string",
            enum: ["depends_on", "relates_to"],
            description: "Edge type (create/update).",
          },
          note: { type: "string", description: "Substantive edge note (create/update)." },
          edgeId: { type: "string", description: "Edge id (update/remove)." },
        },
      },
      execute: async (input: Record<string, unknown>) => piyazCall(config, "piyaz_link", input),
    }),
    createTool({
      name: "piyaz_activity",
      description:
        "Keyset-paginated \"what changed\" feed for a project, task, or note. " +
        "Pass exactly one scope; since is an ISO instant lower bound for resume after compaction.",
      inputSchema: {
        type: "object",
        properties: {
          project: { type: "string", description: "Project identifier or UUID." },
          task: { type: "string", description: "Task ref or UUID." },
          note: { type: "string", description: "Note ref, UUID, or slug (slug needs project)." },
          since: {
            type: "string",
            description: "ISO instant lower bound (e.g. 2026-07-03T10:00:00Z).",
          },
          limit: { type: "number", description: "Max events." },
          cursor: { type: "string", description: "Keyset cursor for the next page." },
        },
      },
      execute: async (input: Record<string, unknown>) =>
        piyazCall(config, "piyaz_activity", input),
    }),
    createTool({
      name: "piyaz_note",
      description:
        "Agent write-back surface over the Piyaz Notes data ring: create, read, " +
        "edit, link tasks, and manage notes and folders.",
      inputSchema: {
        type: "object",
        required: ["action"],
        properties: {
          action: {
            type: "string",
            enum: ["create", "read", "update", "delete", "link", "unlink", "search"],
            description: "Note action.",
          },
          note: { type: "string", description: "Note ref, UUID, or slug." },
          project: { type: "string", description: "Project identifier or UUID (scopes slug lookups)." },
          title: { type: "string", description: "Note title (create)." },
          body: { type: "string", description: "Note body markdown (create/update)." },
          fields: {
            type: "array",
            items: { type: "string" },
            description: "Fields to read (read).",
          },
          operations: {
            type: "array",
            items: { type: "object" },
            description: "Edit operations (update).",
          },
          task: { type: "string", description: "Task ref to link/unlink (link/unlink)." },
        },
      },
      execute: async (input: Record<string, unknown>) => piyazCall(config, "piyaz_note", input),
    }),
  ];
}

/**
 * Create a Piyaz plugin for Cline.
 *
 * @param config - { serverUrl, accessToken? } for the Piyaz MCP server.
 * @returns an AgentPlugin that registers the Piyaz tools and audits every call.
 */
export function createPiyazPlugin(config: PiyazPluginConfig) {
  let totalTokens = 0;
  let toolCalls = 0;

  return {
    name: "piyaz",
    manifest: {
      capabilities: ["tools", "hooks"],
    },
    setup(api: any, ctx: any) {
      // Register all tools before the first iteration; setup must stay sync.
      for (const tool of createPiyazTools(config)) {
        api.registerTool(tool);
      }
    },
    hooks: {
      beforeRun() {
        toolCalls = 0;
        console.log(`[piyaz] Run started (server: ${config.serverUrl})`);
      },
      beforeTool(context: HookContext) {
        toolCalls += 1;
        const name = context?.toolCall?.name ?? "unknown";
        const input = context?.input ?? {};
        try {
          const preview = JSON.stringify(input).slice(0, 120);
          console.log(`[piyaz] Tool: ${name} (${preview})`);
        } catch {
          console.log(`[piyaz] Tool: ${name}`);
        }
      },
      afterRun(context: HookContext) {
        const usage = context?.result?.usage;
        if (usage) {
          totalTokens += (usage.inputTokens ?? 0) + (usage.outputTokens ?? 0);
          console.log(
            `[piyaz] Run complete. Calls: ${toolCalls}. Session tokens so far: ${totalTokens}`,
          );
        }
      },
    },
  };
}

/** Default export for CLI-installed package plugins. Reads config from env vars. */
const defaultConfig: PiyazPluginConfig = {
  serverUrl: process.env.PIYAZ_SERVER_URL ?? "https://app.piyaz.ai",
  accessToken: process.env.PIYAZ_ACCESS_TOKEN ?? undefined,
};
export default createPiyazPlugin(defaultConfig);

