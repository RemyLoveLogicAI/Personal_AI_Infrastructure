/**
 * Barrel file for the state-management module (PLAN.md Phase 2).
 */

import { StateManager } from './StateManager';
import type { StateEntry, StateId, StateSnapshot, StateValue } from './types';

export { StateManager } from './StateManager';
export default StateManager;
export {
  StateInvalidError,
  StateNotFoundError,
  type GetOptions,
  type StateEntry,
  type StateId,
  type StatePatch,
  type StateSnapshot,
  type StateTransition,
  type StateValue,
} from './types';

/** Convenience factory: `const sm = createStateManager()` */
export function createStateManager(initial?: StateSnapshot): StateManager {
  return new StateManager(initial);
}

/** Convenience: serialize a snapshot to a pretty-printed JSON string. */
export function serializeSnapshot(snapshot: StateSnapshot): string {
  return JSON.stringify(snapshot, null, 2);
}

/** Convenience: parse a JSON string back into a snapshot (throws on invalid JSON). */
export function deserializeSnapshot(json: string): StateSnapshot {
  const parsed: unknown = JSON.parse(json);
  if (parsed === null || typeof parsed !== 'object' || Array.isArray(parsed)) {
    throw new TypeError('Snapshot JSON must be an object');
  }
  return parsed as StateSnapshot;
}

/** Convenience: fetch just the current value for an id, or a fallback. */
export function getValue(
  manager: StateManager,
  id: StateId,
  fallback?: StateValue
): StateValue | undefined {
  const entry: StateEntry | undefined = manager.get(id, { optional: true });
  return entry ? entry.value : fallback;
}
