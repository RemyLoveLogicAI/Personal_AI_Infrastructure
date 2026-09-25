# Harness Enhancements

Harness Enhancements represent a new category of AI agent tools designed to augment the **agent runtime environment itself**, rather than just the agent's specific prompt or skills.

While **Skills** teach an agent *how* to accomplish a specific task, and **Prompts** tell an agent *what* to do, a **Harness Enhancement** acts as a bridge between the agent's core execution harness (e.g., Claude Code, Antigravity, Cursor) and the broader personal infrastructure.

## Characteristics of a Harness Enhancement

1. **Universal Protocol**: Harness enhancements are primarily built as **MCP (Model Context Protocol)** servers. This makes them universally attachable to any modern AI harness.
2. **Infrastructure Continuation**: They connect the agent's ephemeral, isolated sessions into persistent personal infrastructure (like dashboards, time trackers, unified memory logs).
3. **Environment Augmentation**: They provide tools that are universally applicable to *any* task the agent is doing (e.g., logging performance stats, reporting token usage, checking global health, or exposing a UI HUD).

## Included Enhancements

- [TelemetryMCP](./TelemetryMCP/README.md) - An MCP Server acting as a bridge to push live agent telemetry (tokens, dreams, status) to the `OperationsDashboard`.
