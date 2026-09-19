# Operations Dashboard

A dependency-free, local dashboard for agent operations and personal productivity, designed with the Widget-Based Design and Dashboard Design skills.

## Open

From the repository root:

```sh
python3 Tools/OperationsDashboard/server.py
```

Open http://127.0.0.1:8765. Python 3.10+ is required. Use `--port 8766` if the port is occupied. The server binds only to loopback.

## What works

- Operations: OpenClaw, Hermes, Claude Code, and Codex status; session counts, token and credit totals, gateway health, dreaming log entries, timestamps and stale-data indication.
- Manual refresh and automatic refresh every 30 seconds.
- Snapshot import through the dashboard; invalid snapshots are rejected without replacing the last valid import.
- Workboard: task creation/status changes/deletion, daily habit checks, memory review, and a graph of user-created knowledge nodes and links.
- Customizable widget visibility and responsive layout.

Personal workboard data is stored in this browser's localStorage, scoped to the dashboard origin. Use the same host and port to retain access to it. Clearing browser storage removes it. It is not synced to your existing tasks, notes, or habit apps.

## Connect telemetry

The dashboard does **not** infer health from a running process or invent consumption figures. It starts disconnected. Native provider adapters and cloud authentication are not included. Supply a normalized snapshot from your existing collectors, either using the Import control or running:

```sh
python3 Tools/OperationsDashboard/server.py --telemetry /absolute/path/telemetry.json
```

File mode reads the file on every refresh; your collector should replace the file atomically. A missing, oversized, or malformed file produces a visible unavailable state. Browser imports are disabled by the server in file mode. In import mode the latest snapshot lives in server memory and resets when the server stops.

Snapshot shape (illustrative only; replace the timestamp and values with measurements):

```json
{
  "updatedAt": "2026-09-01T12:00:00Z",
  "agents": [
    {
      "name": "Codex",
      "status": "online",
      "sessions": 2,
      "tokens": 12000,
      "credits": null,
      "gateway": "healthy"
    }
  ],
  "dreams": [
    {
      "time": "2026-09-01T11:59:00Z",
      "agent": "Hermes",
      "message": "Your collector's dreaming log entry"
    }
  ]
}
```

Contract:

- `updatedAt`: ISO timestamp with timezone, no future timestamps. Snapshots older than five minutes are stale.
- Names: `OpenClaw`, `Hermes`, `Claude Code`, `Codex`, each at most once. Missing agents remain disconnected with unknown values.
- Status: `online`, `idle`, `offline`, `error`, `disconnected`, `unknown`.
- `sessions` and `tokens`: nonnegative integer or `null` for unknown.
- `credits`: nonnegative finite number or `null`. These are provider credits, not dollars. Only aggregate credits if your collectors normalize to the same unit.
- `gateway`: `healthy`, `degraded`, `down`, `unknown`, or `null`.
- `dreams`: up to 200 entries with `time`, `agent`, `message` strings (4,000 characters maximum per field).
- Payload limit: 1 MiB. Tokens/credits must use the same collection window across agents; this version does not track history or billing periods.

Local producers can POST this JSON to `/api/telemetry` using `Content-Type: application/json`. The server validates host/origin, rejects browser cross-origin writes, and exposes only dashboard assets. Do not forward this port publicly; it has no remote authentication.

## Validation

```sh
python3 -m unittest discover -s Tools/OperationsDashboard -v
node --check Tools/OperationsDashboard/app.js
node Tools/OperationsDashboard/test_app.cjs
```

Tests cover snapshot validation, unknown versus zero, retained imports after validation failures, file-feed errors, and HTTP boundaries.

The DOM-stub behavior smoke test covers unknown telemetry, task persistence, habit checks, memory review, graph links, and node removal. It does not test browser layout. Browser verification in this session was blocked by the available Chrome environment; responsive styling has not been visually verified.
