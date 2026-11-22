# Telemetry and HUD Protocol

You have access to the `TelemetryMCP` tools.
Whenever you start a complex task, or experience a significant state change (e.g. going idle, being blocked), you MUST use `telemetry_set_status` to log your state. 
When you are doing background thinking, use `telemetry_log_dream` to record your internal thoughts.
Before handoff or stopping, ALWAYS use `ledger_checkpoint_save` to persist your task context into the Universal Context Ledger so other agents can pick up where you left off.
