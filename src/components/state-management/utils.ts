/**
 * Shared helpers for state-management consumers (PLAN.md Phase 2).
 * Pure functions only — no I/O, no dependencies.
 */

import type { StateSnapshot, StateValue } from './types';

/** Structural deep equality for JSON-safe state values. */
export function deepEqual(
  a: StateValue | undefined,
  b: StateValue | undefined
): boolean {
  if (a === b) return true;
  if (a === undefined || b === undefined) return false;
  if (
    a === null ||
    b === null ||
    typeof a !== 'object' ||
    typeof b !== 'object'
  ) {
    return false;
  }
  if (Array.isArray(a) !== Array.isArray(b)) return false;

  if (Array.isArray(a) && Array.isArray(b)) {
    if (a.length !== b.length) return false;
    for (let i = 0; i < a.length; i++) {
      if (!deepEqual(a[i], b[i])) return false;
    }
    return true;
  }

  const keysA = Object.keys(a);
  const keysB = Object.keys(b);
  if (keysA.length !== keysB.length) return false;
  const objA = a as { [k: string]: StateValue };
  const objB = b as { [k: string]: StateValue };
  return keysA.every((key) => deepEqual(objA[key], objB[key]));
}

/** Merge a partial patch into an object value, returning a new object. */
export function mergePatch(
  current: Record<string, StateValue>,
  patch: Record<string, StateValue>
): Record<string, StateValue> {
  return { ...current, ...patch };
}

/** Snapshot diff: returns ids whose value changed between two snapshots (by identity of entry or value). */
export function diffSnapshot(
  before: StateSnapshot,
  after: StateSnapshot
): { added: string[]; removed: string[]; changed: string[] } {
  const added: string[] = [];
  const removed: string[] = [];
  const changed: string[] = [];

  for (const id of Object.keys(after)) {
    const prev = before[id];
    const next = after[id];
    if (prev === undefined || next === undefined) {
      added.push(id);
    } else if (prev.value !== next.value) {
      changed.push(id);
    }
  }
  for (const id of Object.keys(before)) {
    if (!(id in after)) removed.push(id);
  }
  return { added, removed, changed };
}
