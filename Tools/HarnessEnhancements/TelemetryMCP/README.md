# TelemetryMCP

**A Harness Enhancement for personal AI infrastructure.**

The TelemetryMCP server acts as a universal bridge connecting your AI agents (across any harness like Antigravity, Claude Code, or IDEs) to the `OperationsDashboard`. It provides a standard set of MCP tools that agents can call to push their runtime stats and status.

## Capabilities

The server exposes five MCP tools:
- `telemetry_set_status`: Sets the agent's current state (`online`, `idle`, `error`, etc.) and gateway health.
- `telemetry_add_metrics`: Increments cumulative session stats like tokens, number of sessions, and credits.
- `telemetry_log_dream`: Pushes an entry to the dreaming log.
- `ledger_checkpoint_save`: Write the current state of a task to the Universal Context Ledger (`~/.agentsroom/universal_ledger.json`) so other agents can resume it.
- `ledger_checkpoint_load`: Read the Universal Context Ledger to resume a task left by another agent.

## How it works

When an agent calls one of these tools, the TelemetryMCP server aggregates the changes into an in-memory state object and triggers an asynchronous, non-blocking sync queue. This queue issues a POST request to `http://127.0.0.1:8765/api/telemetry` (the Operations Dashboard) so the agent's event loop is never blocked by HTTP latency or failures. The dashboard instantly updates the Stats HUD.

Additionally, the Universal Context Ledger allows agents to save cross-harness continuation states directly to disk, ensuring no context is lost during handoffs.

## Setup

1. Start your existing Operations Dashboard:
   ```bash
   python3 Tools/OperationsDashboard/server.py
   ```
2. In your agent harness config (e.g. `.mcp.json` or `.agents/mcp_config.json`), add the TelemetryMCP server:
   ```json
   "mcpServers": {
     "telemetry": {
       "command": "node",
       "args": ["/absolute/path/to/Tools/HarnessEnhancements/TelemetryMCP/index.js"]
     }
   }
   ```
3. Agents can now use the tools to report their activity!
