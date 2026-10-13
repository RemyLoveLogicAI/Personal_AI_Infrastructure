# StatsHUD — Spatial Operations Center

A 3D spatial visualization of agent telemetry from the Operations Dashboard
(React Three Fiber + Next.js). Each agent renders as an orbiting node colored
by status: green (`online`), yellow (`idle`), gray (other).

## Run

```bash
npm install
npm run dev
```

Serves on **http://localhost:8766** (the Operations Dashboard owns 8765).
`next.config.mjs` proxies same-origin `/api/telemetry` requests to the
dashboard on `127.0.0.1:8765`, so both can run side by side:

```bash
python3 ../../OperationsDashboard/server.py   # :8765 — telemetry source
npm run dev                                    # :8766 — this HUD
```

## Feed behavior

- `GET /api/telemetry` is polled every 2 seconds.
- A status pill in the top-left panel shows **online** (green),
  **offline** (red, dashboard not running), or **connecting** (yellow).
- When offline the scene renders with zeroed totals and keeps the last
  snapshot it received, mirroring the dashboard's own stale-data behavior.
