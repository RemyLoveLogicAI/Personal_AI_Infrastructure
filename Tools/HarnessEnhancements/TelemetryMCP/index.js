import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { CallToolRequestSchema, ListToolsRequestSchema } from "@modelcontextprotocol/sdk/types.js";
import fs from "fs/promises";
import path from "path";
import os from "os";

// Telemetry State
const state = {
  agents: {},
  dreams: [],
  ledger: {
    tasks: {}
  },
  backlog: [],
  guidance: [],
  milestones: [],
  user_intent: {
    focus: "Universal User-Centric Infrastructure",
    telos: "Empower human agency through proactive, transparent, and seamless AI co-working.",
    priorities: [
      "Zero disruption to existing architecture",
      "Human-in-the-loop attention center",
      "Universal cross-harness state alignment"
    ],
    updatedAt: new Date().toISOString()
  }
};

// Universal state ledger stored locally, synced asynchronously
const LEDGER_FILE = path.join(os.homedir(), ".agentsroom", "universal_ledger.json");
const DASHBOARD_URL = "http://127.0.0.1:8765/api/telemetry";

// Async Sync Queue - Failure Decoupling
let isSyncing = false;
let needsSync = false;

async function syncLoop() {
  if (isSyncing || !needsSync) return;
  isSyncing = true;
  needsSync = false;

  const payload = {
    updatedAt: new Date().toISOString(),
    agents: Object.values(state.agents),
    dreams: state.dreams,
    ledger: state.ledger,
    backlog: state.backlog,
    guidance: state.guidance,
    milestones: state.milestones,
    user_intent: state.user_intent
  };

  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 2000); // 2 second timeout so agent never hangs

    const response = await fetch(DASHBOARD_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
      signal: controller.signal
    });
    clearTimeout(timeoutId);

    if (!response.ok) {
      needsSync = true; // Retry later
    }
  } catch (error) {
    needsSync = true; // Retry later
  } finally {
    isSyncing = false;
    if (needsSync) {
      setTimeout(syncLoop, 5000); // Retry after 5s
    }
  }
}

function triggerSync() {
  needsSync = true;
  // Fire and forget, do not await, this protects the agent event loop
  syncLoop().catch(console.error);
}

async function loadLedger() {
  try {
    const data = await fs.readFile(LEDGER_FILE, 'utf8');
    const parsed = JSON.parse(data);
    if (parsed.tasks) {
      state.ledger = { tasks: parsed.tasks };
    } else {
      // Migrate old format
      state.ledger = { tasks: {} };
      if (parsed.active_task && parsed.active_task.id) {
        state.ledger.tasks[parsed.active_task.id] = parsed;
      }
    }
    if (parsed.user_intent) state.user_intent = parsed.user_intent;
    if (parsed.guidance && Array.isArray(parsed.guidance)) state.guidance = parsed.guidance;
    if (parsed.milestones && Array.isArray(parsed.milestones)) state.milestones = parsed.milestones;
  } catch (e) {
    // If file doesn't exist or is invalid, ignore
  }
}

async function saveLedger() {
  try {
    await fs.mkdir(path.dirname(LEDGER_FILE), { recursive: true });
    const tmpFile = `${LEDGER_FILE}.${Date.now()}.${Math.random().toString(36).slice(2)}.tmp`;
    const toSave = {
      tasks: state.ledger.tasks,
      user_intent: state.user_intent,
      guidance: state.guidance,
      milestones: state.milestones
    };
    await fs.writeFile(tmpFile, JSON.stringify(toSave, null, 2));
    await fs.rename(tmpFile, LEDGER_FILE);
  } catch (e) {
    console.error('Error saving ledger:', e.message);
  }
}

// Ensure an agent exists in state
function ensureAgent(name) {
  if (!state.agents[name]) {
    state.agents[name] = {
      name,
      status: "unknown",
      sessions: 0,
      tokens: 0,
      credits: null,
      gateway: "unknown"
    };
  }
  return state.agents[name];
}

const server = new Server(
  { name: "TelemetryBridge", version: "1.1.0" },
  { capabilities: { tools: {} } }
);

server.setRequestHandler(ListToolsRequestSchema, async () => {
  return {
    tools: [
      {
        name: "telemetry_set_status",
        description: "Set the status and gateway health for an AI agent.",
        inputSchema: {
          type: "object",
          properties: {
            agent: { type: "string" },
            status: { type: "string", enum: ["online", "idle", "offline", "error", "disconnected", "unknown"] },
            gateway: { type: "string", enum: ["healthy", "degraded", "down", "unknown"] }
          },
          required: ["agent", "status"]
        }
      },
      {
        name: "telemetry_add_metrics",
        description: "Increment metrics like tokens, sessions, or credits for an agent.",
        inputSchema: {
          type: "object",
          properties: {
            agent: { type: "string" },
            tokens: { type: "number" },
            sessions: { type: "number" },
            credits: { type: "number" }
          },
          required: ["agent"]
        }
      },
      {
        name: "telemetry_log_dream",
        description: "Log a dreaming or background thought entry for an agent.",
        inputSchema: {
          type: "object",
          properties: {
            agent: { type: "string" },
            message: { type: "string" }
          },
          required: ["agent", "message"]
        }
      },
      {
        name: "ledger_checkpoint_save",
        description: "Write the current state of a task to the Universal Context Ledger so other agents can resume it.",
        inputSchema: {
          type: "object",
          properties: {
            active_task: {
              type: "object",
              properties: {
                id: { type: "string" },
                goal: { type: "string" },
                status: { type: "string" }
              }
            },
            context_continuation: {
              type: "object",
              properties: {
                handoff_summary: { type: "string" },
                blocked_on: { type: "string" },
                open_threads: { type: "array", items: { type: "string" } }
              }
            },
            shared_memory_pointers: { type: "array", items: { type: "string" } }
          },
          required: ["active_task", "context_continuation"]
        }
      },
      {
        name: "ledger_checkpoint_load",
        description: "Read the Universal Context Ledger to resume a task left by another agent. Provide task_id to load a specific task, or leave empty to list all.",
        inputSchema: {
          type: "object",
          properties: {
            task_id: { type: "string", description: "Optional. The ID of the task to load." }
          }
        }
      },
      {
        name: "telemetry_sync_backlog",
        description: "Push current backlog tasks to the Operations Dashboard Workboard.",
        inputSchema: {
          type: "object",
          properties: {
            tasks: {
              type: "array",
              items: {
                type: "object",
                properties: {
                  id: { type: "string" },
                  title: { type: "string" },
                  status: { type: "string", enum: ["backlog", "doing", "done"] }
                },
                required: ["id", "title", "status"]
              }
            }
          },
          required: ["tasks"]
        }
      },
      {
        name: "telemetry_request_guidance",
        description: "Request user guidance, decision, or input from the human operator via the Operations Dashboard.",
        inputSchema: {
          type: "object",
          properties: {
            agent: { type: "string" },
            question: { type: "string" },
            options: { type: "array", items: { type: "string" } },
            context: { type: "string" }
          },
          required: ["agent", "question"]
        }
      },
      {
        name: "telemetry_resolve_guidance",
        description: "Mark a user guidance request as resolved with the human operator's response.",
        inputSchema: {
          type: "object",
          properties: {
            id: { type: "string" },
            resolution: { type: "string" }
          },
          required: ["id", "resolution"]
        }
      },
      {
        name: "telemetry_report_milestone",
        description: "Report an executive milestone or notable achievement to the user's live dashboard.",
        inputSchema: {
          type: "object",
          properties: {
            agent: { type: "string" },
            title: { type: "string" },
            description: { type: "string" },
            category: { type: "string", enum: ["architecture", "feature", "refactor", "qa", "release", "general"] },
            artifacts: { type: "array", items: { type: "string" } }
          },
          required: ["agent", "title", "description"]
        }
      },
      {
        name: "telemetry_set_user_intent",
        description: "Update the user's active intent, focus, or Telos in the central ledger.",
        inputSchema: {
          type: "object",
          properties: {
            focus: { type: "string" },
            telos: { type: "string" },
            priorities: { type: "array", items: { type: "string" } }
          },
          required: ["focus"]
        }
      },
      {
        name: "telemetry_get_user_intent",
        description: "Retrieve the user's current strategic focus, Telos, and priorities to align agent work.",
        inputSchema: {
          type: "object",
          properties: {}
        }
      }
    ]
  };
});

server.setRequestHandler(CallToolRequestSchema, async (request) => {
  try {
    const { name, arguments: args } = request.params;

    if (name === "telemetry_set_status") {
      const agentObj = ensureAgent(args.agent);
      agentObj.status = args.status;
      if (args.gateway) agentObj.gateway = args.gateway;
      triggerSync(); // Fire and forget
      return { content: [{ type: "text", text: `Status updated for ${args.agent}` }] };
    }

    if (name === "telemetry_add_metrics") {
      const agentObj = ensureAgent(args.agent);
      if (args.tokens) agentObj.tokens += args.tokens;
      if (args.sessions) agentObj.sessions += args.sessions;
      if (args.credits) {
        if (agentObj.credits === null) agentObj.credits = 0;
        agentObj.credits += args.credits;
      }
      triggerSync();
      return { content: [{ type: "text", text: `Metrics updated for ${args.agent}` }] };
    }

    if (name === "telemetry_log_dream") {
      ensureAgent(args.agent);
      state.dreams.push({
        time: new Date().toISOString(),
        agent: args.agent,
        message: args.message
      });
      if (state.dreams.length > 200) state.dreams.shift();
      triggerSync();
      return { content: [{ type: "text", text: `Dream logged for ${args.agent}` }] };
    }

    if (name === "ledger_checkpoint_save") {
      await loadLedger(); // refresh local state before overwriting
      
      const taskId = args.active_task && args.active_task.id ? args.active_task.id : "default";
      
      state.ledger.tasks[taskId] = {
        active_task: args.active_task,
        context_continuation: args.context_continuation,
        shared_memory_pointers: args.shared_memory_pointers || []
      };
      await saveLedger();
      triggerSync();
      return { content: [{ type: "text", text: `Context ledger saved successfully under task ${taskId}.` }] };
    }

    if (name === "ledger_checkpoint_load") {
      await loadLedger();
      
      const taskId = args.task_id;
      if (taskId && state.ledger.tasks[taskId]) {
        return { content: [{ type: "text", text: JSON.stringify(state.ledger.tasks[taskId], null, 2) }] };
      }
      return { content: [{ type: "text", text: JSON.stringify(state.ledger, null, 2) }] };
    }

    if (name === "telemetry_sync_backlog") {
      state.backlog = args.tasks;
      triggerSync();
      return { content: [{ type: "text", text: `Backlog synced successfully.` }] };
    }

    if (name === "telemetry_request_guidance") {
      ensureAgent(args.agent);
      const guidanceItem = {
        id: `guidance-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
        agent: args.agent,
        question: args.question,
        options: args.options || [],
        context: args.context || "",
        time: new Date().toISOString(),
        status: "pending",
        resolution: null
      };
      state.guidance.unshift(guidanceItem);
      if (state.guidance.length > 100) state.guidance.pop();
      await saveLedger();
      triggerSync();
      return {
        content: [{
          type: "text",
          text: `Guidance request [${guidanceItem.id}] submitted: "${args.question}"`
        }]
      };
    }

    if (name === "telemetry_resolve_guidance") {
      const item = state.guidance.find(g => g.id === args.id);
      if (!item) {
        throw new Error(`Guidance request with id ${args.id} not found.`);
      }
      item.status = "resolved";
      item.resolution = args.resolution;
      item.resolvedAt = new Date().toISOString();
      await saveLedger();
      triggerSync();
      return {
        content: [{
          type: "text",
          text: `Guidance request [${args.id}] resolved with: "${args.resolution}"`
        }]
      };
    }

    if (name === "telemetry_report_milestone") {
      ensureAgent(args.agent);
      const milestone = {
        id: `ms-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
        time: new Date().toISOString(),
        agent: args.agent,
        title: args.title,
        description: args.description,
        category: args.category || "general",
        artifacts: args.artifacts || []
      };
      state.milestones.unshift(milestone);
      if (state.milestones.length > 200) state.milestones.pop();
      await saveLedger();
      triggerSync();
      return {
        content: [{
          type: "text",
          text: `Milestone "${args.title}" recorded for ${args.agent}.`
        }]
      };
    }

    if (name === "telemetry_set_user_intent") {
      state.user_intent = {
        focus: args.focus,
        telos: args.telos || (state.user_intent && state.user_intent.telos) || "",
        priorities: args.priorities || (state.user_intent && state.user_intent.priorities) || [],
        updatedAt: new Date().toISOString()
      };
      await saveLedger();
      triggerSync();
      return {
        content: [{
          type: "text",
          text: `User intent updated. Active focus: "${args.focus}".`
        }]
      };
    }

    if (name === "telemetry_get_user_intent") {
      await loadLedger();
      return {
        content: [{
          type: "text",
          text: JSON.stringify(state.user_intent || { focus: "Universal System Enhancement", telos: "User-centric autonomous life OS", priorities: [] }, null, 2)
        }]
      };
    }

    throw new Error(`Unknown tool: ${name}`);
  } catch (error) {
    return {
      content: [{ type: "text", text: `Error: ${error.message}` }],
      isError: true
    };
  }
});

// Init ledger then connect
loadLedger().then(() => {
  const transport = new StdioServerTransport();
  server.connect(transport).catch(error => {
    console.error("Fatal error connecting transport:", error);
    process.exit(1);
  });
});
