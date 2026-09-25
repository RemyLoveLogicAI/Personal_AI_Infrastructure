/**
 * Pulse Module: HITL Gate Bus
 *
 * Blocking approval gates for high blast-radius actions. Agents (via the
 * SecurityPipeline hook) create gates; the PAI Cockpit TUI decides them with
 * an X-PAI-Token header; the hook consumes an approval exactly once.
 *
 * ponytail: cockpit.token is readable by same-UID processes (blocked bash
 * patterns + zeroAccess path raise the bar). Upgrade path: OS user/container
 * separation for the cockpit.
 */
import { join } from "path"
import { mkdirSync, readFileSync, writeFileSync, renameSync, existsSync, chmodSync } from "fs"
import { randomBytes } from "crypto"
const HOME = process.env.HOME ?? "~"
const PULSE_DIR = join(HOME, ".claude", "PAI", "PULSE")
// PAI_GATES_DIR is a test seam; runtime default is the Pulse state directory.
const STATE_DIR = process.env.PAI_GATES_DIR ?? join(PULSE_DIR, "state")
const GATES_FILE = join(STATE_DIR, "gates.json")
const TOKEN_FILE = join(STATE_DIR, "cockpit.token")

export type GateKind = "action" | "loop"
export type GateSeverity = "warning" | "caution"
export type GateStatus = "pending" | "approved" | "denied" | "acked" | "consumed"

export interface Gate {
  id: string
  kind: GateKind
  severity: GateSeverity
  source: string
  title: string
  detail: string
  fingerprint?: string
  status: GateStatus
  createdAt: string
  decidedAt?: string
  decidedBy?: string
}

let gates: Gate[] = []
let token = ""

// ── Persistence (atomic, mirrors TelemetryMCP saveLedger pattern) ──

function persist(): void {
  try {
    mkdirSync(STATE_DIR, { recursive: true })
    const tmp = `${GATES_FILE}.${Date.now()}.${Math.random().toString(36).slice(2)}.tmp`
    writeFileSync(tmp, JSON.stringify(gates, null, 2))
    renameSync(tmp, GATES_FILE)
  } catch (e) {
    console.error("gates: persist failed:", String(e))
  }
}

function pruneDecided(): void {
  const cutoff = Date.now() - 24 * 60 * 60 * 1000
  gates = gates.filter(g => {
    if (!g.decidedAt) return true
    return new Date(g.decidedAt).getTime() > cutoff
  })
}

function load(): void {
  try {
    if (existsSync(GATES_FILE)) {
      const parsed = JSON.parse(readFileSync(GATES_FILE, "utf-8"))
      if (Array.isArray(parsed)) gates = parsed
    }
  } catch { /* corrupt file → start fresh */ }
  pruneDecided()
}

// ── Token ──

function loadToken(): void {
  try {
    if (existsSync(TOKEN_FILE)) {
      token = readFileSync(TOKEN_FILE, "utf-8").trim()
      if (token) return
    }
    token = randomBytes(32).toString("hex")
    mkdirSync(STATE_DIR, { recursive: true })
    writeFileSync(TOKEN_FILE, token, { mode: 0o600 })
    try { chmodSync(TOKEN_FILE, 0o600) } catch { /* best-effort */ }
  } catch (e) {
    console.error("gates: token init failed:", String(e))
  }
}

export function startGates(): void {
  load()
  loadToken()
}

// ── Helpers ──

function bad(body: Record<string, unknown>, msg: string): Response {
  return Response.json({ error: msg }, { status: 400 })
}

function str(v: unknown): string | null {
  return typeof v === "string" ? v : null
}

function findRecentDenied(fingerprint: string): Gate | null {
  const cutoff = Date.now() - 60_000
  return gates.find(g =>
    g.fingerprint === fingerprint &&
    g.status === "denied" &&
    g.decidedAt !== undefined &&
    new Date(g.decidedAt).getTime() > cutoff
  ) ?? null
}

// ── Route Handler ──

export async function handleGatesRequest(req: Request, pathname: string): Promise<Response | null> {
  if (!pathname.startsWith("/api/gates")) return null

  let body: Record<string, unknown> = {}
  try {
    body = await req.json() as Record<string, unknown>
  } catch { body = {} }

  // POST /api/gates — create (any local process; decisions are token-guarded)
  if (req.method === "POST" && pathname === "/api/gates") {
    const kind = str(body.kind)
    const severity = str(body.severity)
    const source = str(body.source)
    const title = str(body.title)
    const detail = str(body.detail)
    if (kind !== "action" && kind !== "loop") return bad(body, "kind must be action|loop")
    if (severity !== "warning" && severity !== "caution") return bad(body, "severity must be warning|caution")
    if (!source || source.length > 100) return bad(body, "source required, max 100 chars")
    if (!title || title.length > 200) return bad(body, "title required, max 200 chars")
    if (detail === null || detail.length > 4000) return bad(body, "detail required, max 4000 chars")

    const fingerprint = str(body.fingerprint) ?? undefined
    if (kind === "action" && fingerprint) {
      const existing = gates.find(g => g.kind === "action" && g.fingerprint === fingerprint && g.status === "pending")
      if (existing) return Response.json({ gate: existing }, { status: 200 })
    }

    const gate: Gate = {
      id: `gate-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      kind, severity, source, title, detail,
      fingerprint,
      status: "pending",
      createdAt: new Date().toISOString(),
    }
    gates.unshift(gate)
    persist()
    return Response.json({ gate }, { status: 201 })
  }

  // GET /api/gates?fingerprint=
  if (req.method === "GET" && pathname === "/api/gates") {
    const fingerprint = new URL(req.url).searchParams.get("fingerprint")
    const list = fingerprint ? gates.filter(g => g.fingerprint === fingerprint) : gates
    return Response.json({ gates: list })
  }

  // POST /api/gates/decide — token required
  if (req.method === "POST" && pathname === "/api/gates/decide") {
    if (!token || req.headers.get("X-PAI-Token") !== token) {
      return Response.json({ error: "Invalid or missing X-PAI-Token" }, { status: 401 })
    }
    const id = str(body.id)
    const decision = str(body.decision)
    const gate = gates.find(g => g.id === id)
    if (!gate) return Response.json({ error: `Unknown gate ${id}` }, { status: 404 })
    if (gate.status !== "pending") return Response.json({ error: `Gate ${id} already ${gate.status}` }, { status: 409 })

    if (gate.kind === "action") {
      if (decision !== "approve" && decision !== "deny") {
        return bad(body, "action gates accept approve|deny")
      }
      gate.status = decision === "approve" ? "approved" : "denied"
    } else {
      if (decision !== "ack") return bad(body, "loop gates accept ack")
      gate.status = "acked"
    }
    gate.decidedAt = new Date().toISOString()
    gate.decidedBy = "cockpit"
    persist()
    return Response.json({ gate })
  }

  // POST /api/gates/consume — unauthenticated (consumption only removes rights)
  if (req.method === "POST" && pathname === "/api/gates/consume") {
    const fingerprint = str(body.fingerprint)
    if (!fingerprint) return bad(body, "fingerprint required")
    const gate = gates.find(g =>
      g.fingerprint === fingerprint && (g.status === "approved" || g.status === "consumed")
    )
    if (!gate) return Response.json({ consumed: false, reason: "no approved gate" }, { status: 409 })
    if (gate.status === "consumed") return Response.json({ consumed: false, reason: "already consumed" }, { status: 409 })
    if (gate.decidedAt && new Date(gate.decidedAt).getTime() < Date.now() - 10 * 60_000) {
      return Response.json({ consumed: false, reason: "approval expired" }, { status: 409 })
    }
    gate.status = "consumed"
    persist()
    return Response.json({ consumed: true })
  }

  return null
}
