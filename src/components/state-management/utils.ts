/**
 * Shared helpers for state-management consumers (PLAN.md Phase 2).
 * Pure functions only — no I/O, no dependencies.
 */

import { StateInvalidError, type StateSnapshot, type StateValue } from './types';

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

/**
 * True when `v` is JSON-safe: a JSON round-trip preserves it exactly
 * (no undefined, functions, NaN/Infinity, class instances, or nested ones).
 */
export function isJsonValue(v: unknown): v is StateValue {
  if (v === null) return true;
  switch (typeof v) {
    case 'string':
    case 'boolean':
      return true;
    case 'number':
      return Number.isFinite(v);
    case 'object':
      break;
    default:
      return false; // undefined, function, symbol, bigint
  }
  if (Array.isArray(v)) return v.every(isJsonValue);
  const proto = Object.getPrototypeOf(v);
  if (proto !== Object.prototype && proto !== null) return false;
  return Object.values(v).every(isJsonValue);
}

/** Throw `StateInvalidError` unless `value` is JSON-safe. */
export function assertJsonValue(value: unknown, context = 'value'): void {
  if (!isJsonValue(value)) {
    throw new StateInvalidError(
      `State ${context} must be JSON-safe (no undefined, functions, NaN/Infinity, or class instances)`
    );
  }
}

/** Merge a partial patch into an object value, returning a new object. */
export function mergePatch(
  current: Record<string, StateValue>,
  patch: Record<string, StateValue>
): Record<string, StateValue> {
  return { ...current, ...patch };
}

/**
 * Snapshot diff: returns ids whose value changed between two snapshots.
 * Values are compared structurally (`deepEqual`), not by reference — snapshots
 * deep-clone their entries, so identity comparison would report every
 * object/array entry as changed (QA-001).
 */
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
    } else if (!deepEqual(prev.value, next.value)) {
      changed.push(id);
    }
  }
  for (const id of Object.keys(before)) {
    if (!(id in after)) removed.push(id);
  }
  return { added, removed, changed };
}
