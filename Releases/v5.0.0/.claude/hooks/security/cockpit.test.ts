/**
 * Cockpit gate routing tests. Mocks fetch to avoid a Pulse dependency.
 * bun test security/cockpit.test.ts
 */
import { describe, test, expect, beforeAll, afterAll, beforeEach } from "bun:test"

const originalFetch = global.fetch
let checkResponse: { status: number; body: unknown } = { status: 200, body: { decision: "ask" } }
let gateResponse: { status: number; body: unknown } = {
  status: 201,
  body: { gate: { id: "gate-123" } },
}

beforeAll(() => {
  global.fetch = async (url: string, init?: RequestInit) => {
    const u = new URL(url)
    if (u.pathname === "/api/gates" && init?.method === "POST") {
      const body = JSON.parse(init.body as string)
      if (!body.kind || !body.severity || !body.source || !body.title) {
        return new Response("Bad request", { status: 400 })
      }
      return Response.json(gateResponse.body, { status: gateResponse.status })
    }
    if (u.pathname === "/api/gates/check" && init?.method === "POST") {
      return Response.json(checkResponse.body, { status: checkResponse.status })
    }
    return new Response("Not found", { status: 404 })
  }
})

afterAll(() => {
  global.fetch = originalFetch
})

beforeEach(() => {
  checkResponse = { status: 200, body: { decision: "ask" } }
  gateResponse = { status: 201, body: { gate: { id: "gate-123" } } }
})

describe("cockpit gate routing", () => {
  test("createGate returns gateId on 201", async () => {
    const { createGate } = await import("./cockpit")
    const result = await createGate("action", "warning", "test", "Push", "git push", "fp-1")
    expect(result).toEqual({ gateId: "gate-123" })
  })

  test("createGate returns null on 400", async () => {
    const { createGate } = await import("./cockpit")
    const result = await createGate("action", "warning", "", "Push", "git push", "fp-1")
    expect(result).toBeNull()
  })

  test("checkGate maps the three server decisions", async () => {
    const { checkGate } = await import("./cockpit")
    for (const decision of ["allow", "deny", "ask"] as const) {
      checkResponse = { status: 200, body: { decision } }
      expect(await checkGate("fp-1")).toBe(decision)
    }
  })

  test("checkGate fails safe to 'ask' on transport error or bad status", async () => {
    const { checkGate } = await import("./cockpit")
    global.fetch = async () => { throw new Error("network") }
    expect(await checkGate("fp-1")).toBe("ask")
    global.fetch = async () => new Response("boom", { status: 500 })
    expect(await checkGate("fp-1")).toBe("ask")
  })

  test("checkGate fails safe to 'ask' on an unrecognised decision", async () => {
    const { checkGate } = await import("./cockpit")
    checkResponse = { status: 200, body: { decision: "allow-everything" } }
    expect(await checkGate("fp-1")).toBe("ask")
  })
})

describe("fingerprintFor", () => {
  test("is stable across calls and independent of key order", async () => {
    const { fingerprintFor } = await import("./cockpit")
    const a = fingerprintFor("Bash", { command: "ls", cwd: "/tmp" })
    const b = fingerprintFor("Bash", { cwd: "/tmp", command: "ls" })
    expect(a).toBe(b)
    expect(a).toHaveLength(32)
  })

  test("differs when the tool or the input differs", async () => {
    const { fingerprintFor } = await import("./cockpit")
    const base = fingerprintFor("Bash", { command: "ls" })
    expect(fingerprintFor("Write", { command: "ls" })).not.toBe(base)
    expect(fingerprintFor("Bash", { command: "rm -rf /" })).not.toBe(base)
  })
})
