/**
 * Barrel file for the state-management module (PLAN.md Phase 2).
 */

import { StateManager } from './StateManager';
import { isJsonValue } from './utils';
import type { StateEntry, StateId, StateSnapshot, StateValue } from './types';
import { StateInvalidError } from './types';

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

/**
 * Structural check for one snapshot entry: string id, JSON-safe value,
 * numeric revision/createdAt/updatedAt. Rejects files that are valid JSON
 * but not valid snapshots (QA-002) instead of loading broken entries.
 */
function isValidEntry(id: string, entry: unknown): entry is StateEntry {
  if (entry === null || typeof entry !== 'object' || Array.isArray(entry)) {
    return false;
  }
  const e = entry as Record<string, unknown>;
  if (e['id'] !== id || typeof e['id'] !== 'string') return false;
  if (
    typeof e['revision'] !== 'number' ||
    typeof e['createdAt'] !== 'number' ||
    typeof e['updatedAt'] !== 'number'
  ) {
    return false;
  }
  return isJsonValue(e['value']);
}

/**
 * Parse a JSON string back into a validated snapshot. Throws `TypeError` on
 * invalid JSON or a non-object root, and `StateInvalidError` when any entry
 * fails shape validation (so corrupt-but-parseable files are rejected,
 * never silently loaded as broken entries).
 */
export function deserializeSnapshot(json: string): StateSnapshot {
  const parsed: unknown = JSON.parse(json);
  if (parsed === null || typeof parsed !== 'object' || Array.isArray(parsed)) {
    throw new TypeError('Snapshot JSON must be an object');
  }
  for (const [id, entry] of Object.entries(parsed)) {
    if (!isValidEntry(id, entry)) {
      throw new StateInvalidError(
        `Snapshot entry '${id}' is not a valid StateEntry (missing/mismatched id, value, revision, or timestamps)`
      );
    }
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
