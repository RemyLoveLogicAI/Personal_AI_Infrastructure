/**
 * Gates module tests. Runs hermetically: PAI_GATES_DIR points at a temp dir.
 * bun test modules/gates.test.ts
 */
import { describe, test, beforeAll, expect } from "bun:test"
import { mkdtempSync, readFileSync } from "fs"
import { tmpdir } from "os"
import { join } from "path"

process.env.PAI_GATES_DIR = mkdtempSync(join(tmpdir(), "pai-gates-test-"))

// Dynamic import to avoid ESM hoisting: STATE_DIR must see the env override.
const gatesModule = await import("./gates")
const startGates = gatesModule.startGates
const handleGatesRequest = gatesModule.handleGatesRequest

function makeGate(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    kind: "action", severity: "warning", source: "test",
    title: "Push to main", detail: "git push origin main", ...overrides,
  }
}

async function post(pathname: string, body: unknown, headers: Record<string, string> = {}): Promise<Response> {
  return handleGatesRequest(
    new Request(`http://127.0.0.1:31337${pathname}`, {
      method: "POST",
      headers: { "Content-Type": "application/json", ...headers },
      body: JSON.stringify(body),
    }),
    pathname,
  ) as Promise<Response>
}

async function get(url: string): Promise<Response> {
  const pathname = new URL(url, "http://127.0.0.1:31337").pathname
  return handleGatesRequest(new Request(`http://127.0.0.1:31337${url}`), pathname) as Promise<Response>
}


function token(): string {
  return readFileSync(join(process.env.PAI_GATES_DIR!, "cockpit.token"), "utf-8").trim()
}

beforeAll(() => startGates())

describe("gates bus", () => {
  test("create → decide without token is 401", async () => {
    const created = await post("/api/gates", makeGate())
    expect(created.status).toBe(201)
    const { gate } = await created.json()
    const decided = await post("/api/gates/decide", { id: gate.id, decision: "approve" })
    expect(decided.status).toBe(401)
  })

  test("approve → consume works once, second consume 409", async () => {
    const created = await post("/api/gates", makeGate({ fingerprint: "fp-1" }))
    const { gate } = await created.json()
    const decided = await post("/api/gates/decide", { id: gate.id, decision: "approve" }, { "X-PAI-Token": token() })
    expect(decided.status).toBe(200)
    const consumed = await post("/api/gates/consume", { fingerprint: "fp-1" })
    expect(consumed.status).toBe(200)
    expect(await consumed.json()).toEqual({ consumed: true })
    const again = await post("/api/gates/consume", { fingerprint: "fp-1" })
    expect(again.status).toBe(409)
  })

  test("action gate dedup on fingerprint while pending", async () => {
    const first = await post("/api/gates", makeGate({ fingerprint: "fp-dup", title: "A" }))
    expect(first.status).toBe(201)
    const second = await post("/api/gates", makeGate({ fingerprint: "fp-dup", title: "B" }))
    expect(second.status).toBe(200)
    const { gate } = await second.json()
    expect(gate.title).toBe("A")
  })

  test("ack on an action gate is 400; ack on a loop gate is 200", async () => {
    const actionGate = await post("/api/gates", makeGate({ fingerprint: "fp-a" }))
    const { gate: a } = await actionGate.json()
    const badAck = await post("/api/gates/decide", { id: a.id, decision: "ack" }, { "X-PAI-Token": token() })
    expect(badAck.status).toBe(400)

    const loopGate = await post("/api/gates", makeGate({ kind: "loop", severity: "caution", fingerprint: "fp-l" }))
    const { gate: l } = await loopGate.json()
    const acked = await post("/api/gates/decide", { id: l.id, decision: "ack" }, { "X-PAI-Token": token() })
    expect(acked.status).toBe(200)
  })

  test("decide on an already decided gate is 409; unknown id is 404", async () => {
    const created = await post("/api/gates", makeGate({ fingerprint: "fp-2" }))
    const { gate } = await created.json()
    await post("/api/gates/decide", { id: gate.id, decision: "deny" }, { "X-PAI-Token": token() })
    const redecide = await post("/api/gates/decide", { id: gate.id, decision: "deny" }, { "X-PAI-Token": token() })
    expect(redecide.status).toBe(409)
    const missing = await post("/api/gates/decide", { id: "gate-nope", decision: "deny" }, { "X-PAI-Token": token() })
    expect(missing.status).toBe(404)
  })

  test("list filters by fingerprint; create validates fields", async () => {
    const listed = await get("/api/gates?fingerprint=fp-1")
    const { gates } = await listed.json()
    expect(gates.length).toBe(1)
    const invalid = await post("/api/gates", makeGate({ kind: "weird" }))
    expect(invalid.status).toBe(400)
  })

  test("check returns ask when nothing is approved", async () => {
    const created = await post("/api/gates", makeGate({ fingerprint: "fp-check-ask" }))
    expect(created.status).toBe(201)
    const checked = await post("/api/gates/check", { fingerprint: "fp-check-ask" })
    expect(checked.status).toBe(200)
    expect((await checked.json()).decision).toBe("ask")
  })

  test("check allows an approved gate exactly once, then asks again", async () => {
    const created = await post("/api/gates", makeGate({ fingerprint: "fp-once" }))
    const { gate } = await created.json()
    await post("/api/gates/decide", { id: gate.id, decision: "approve" }, { "X-PAI-Token": token() })

    const first = await post("/api/gates/check", { fingerprint: "fp-once" })
    expect((await first.json()).decision).toBe("allow")

    const second = await post("/api/gates/check", { fingerprint: "fp-once" })
    expect((await second.json()).decision).toBe("ask")
  })

  test("check denies when the gate was recently denied", async () => {
    const created = await post("/api/gates", makeGate({ fingerprint: "fp-deny" }))
    const { gate } = await created.json()
    await post("/api/gates/decide", { id: gate.id, decision: "deny" }, { "X-PAI-Token": token() })

    const checked = await post("/api/gates/check", { fingerprint: "fp-deny" })
    const body = await checked.json()
    expect(body.decision).toBe("deny")
    expect(body.reason).toBeTruthy()
  })

  test("check requires a fingerprint", async () => {
    const checked = await post("/api/gates/check", {})
    expect(checked.status).toBe(400)
  })
})
