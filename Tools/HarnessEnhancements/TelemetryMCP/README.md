# TelemetryMCP

**A Harness Enhancement for personal AI infrastructure.**

The TelemetryMCP server acts as a universal bridge connecting your AI agents (across any harness like Antigravity, Claude Code, or IDEs) to the `OperationsDashboard`. It provides a standard set of MCP tools that agents can call to push their runtime stats and status.

## Capabilities

The server exposes eleven universal MCP tools:
- `telemetry_set_status`: Sets the agent's current state (`online`, `idle`, `error`, etc.) and gateway health.
- `telemetry_add_metrics`: Increments cumulative session stats like tokens, number of sessions, and credits.
- `telemetry_log_dream`: Pushes an entry to the background dreaming log.
- `telemetry_sync_backlog`: Pushes task items to the Operations Dashboard workboard.
- `telemetry_request_guidance`: Requests user guidance or decisions from the human operator via the Operations Dashboard.
- `telemetry_resolve_guidance`: Marks a guidance request as resolved with the user's response.
- `telemetry_report_milestone`: Reports high-level executive milestones and deliverables to the user's dashboard feed.
- `telemetry_set_user_intent`: Updates the user's strategic focus, Telos, and top priorities in the central ledger.
- `telemetry_get_user_intent`: Queries the user's active intent so any agent across harnesses stays aligned.
- `ledger_checkpoint_save`: Writes task state to the Universal Context Ledger (`~/.agentsroom/universal_ledger.json`) for cross-harness handoff.
- `ledger_checkpoint_load`: Reads the Universal Context Ledger to resume a task left by another agent.

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
