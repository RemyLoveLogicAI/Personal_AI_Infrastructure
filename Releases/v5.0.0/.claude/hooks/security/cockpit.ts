/**
 * Cockpit Gate Routing
 *
 * When an inspector returns `require_approval`, create a HITL gate via the
 * Pulse daemon's /api/gates endpoint. The cockpit TUI (later) decides it.
 *
 * ponytail: direct fetch to localhost:31337; upgrade path: configurable pulseUrl.
 */
import type { InspectionResult } from './types'

const PULSE_URL = process.env.PULSE_URL ?? 'http://127.0.0.1:31337'

export async function createGate(
  kind: 'action' | 'loop',
  severity: 'warning' | 'caution',
  source: string,
  title: string,
  detail: string,
  fingerprint?: string,
): Promise<{ gateId: string } | null> {
  try {
    const resp = await fetch(`${PULSE_URL}/api/gates`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ kind, severity, source, title, detail, fingerprint }),
    })
    if (resp.status === 201) {
      const { gate } = (await resp.json()) as { gate: { id: string } }
      return { gateId: gate.id }
    }
    console.error('[cockpit] gate creation failed:', resp.status, await resp.text())
    return null
  } catch (e) {
    console.error('[cockpit] gate creation error:', String(e))
    return null
  }
}

export async function consumeGate(fingerprint: string): Promise<boolean> {
  try {
    const resp = await fetch(`${PULSE_URL}/api/gates/consume`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ fingerprint }),
    })
    if (resp.status === 200) {
      const { consumed } = (await resp.json()) as { consumed: boolean }
      return consumed
    }
    return false
  } catch {
    return false
  }
}
