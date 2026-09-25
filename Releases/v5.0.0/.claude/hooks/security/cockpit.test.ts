/**
 * Cockpit gate routing tests. Mocks fetch to avoid Pulse dependency.
 * bun test security/cockpit.test.ts
 */
import { describe, test, expect, beforeAll, afterAll } from "bun:test"

const originalFetch = global.fetch

beforeAll(() => {
  global.fetch = async (url: string, init?: RequestInit) => {
    const u = new URL(url)
    if (u.pathname === "/api/gates" && init?.method === "POST") {
      const body = JSON.parse(init.body as string)
      if (!body.kind || !body.severity || !body.source || !body.title) {
        return new Response("Bad request", { status: 400 })
      }
      return Response.json({ gate: { id: "gate-123" } }, { status: 201 })
    }
    if (u.pathname === "/api/gates/consume" && init?.method === "POST") {
      const body = JSON.parse(init.body as string)
      if (!body.fingerprint) return Response.json({ consumed: false }, { status: 400 })
      return Response.json({ consumed: true }, { status: 200 })
    }
    return new Response("Not found", { status: 404 })
  }
})

afterAll(() => {
  global.fetch = originalFetch
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

  test("consumeGate returns true on 200 consumed", async () => {
    const { consumeGate } = await import("./cockpit")
    const result = await consumeGate("fp-1")
    expect(result).toBe(true)
  })

  test("consumeGate returns false on error", async () => {
    global.fetch = async () => { throw new Error("network") }
    const { consumeGate } = await import("./cockpit")
    const result = await consumeGate("fp-1")
    expect(result).toBe(false)
  })
})
