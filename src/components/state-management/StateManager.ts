import {
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

/** Monotonic clock helper — isolated for tests to stub if ever needed. */
const now = (): number => Date.now();

/**
 * Deep-clone a JSON-safe value (or entry) so the store fully owns its data
 * and no caller can mutate stored state through a returned reference.
 * Values are documented as JSON-safe, so structuredClone (or a JSON
 * round-trip as a fallback) is both correct and fast.
 */
function clone<T>(value: T): T {
  if (typeof structuredClone === 'function') return structuredClone(value);
  return JSON.parse(JSON.stringify(value)) as T;
}

/** Clone a state value. */
const cloneValue = (value: StateValue): StateValue => clone(value);

/** Validating helper: ids must be non-empty strings. */
function assertId(id: StateId): void {
  if (typeof id !== 'string' || id.length === 0) {
    throw new StateInvalidError('State id must be a non-empty string');
  }
}

/**
 * Dependency-free state container.
 *
 * Stores JSON-safe values keyed by id, tracks revision counters and
 * timestamps, and applies pure transition functions atomically. Every value
 * crossing the API boundary is deep-cloned: callers can never observe or
 * mutate stored state through returned references.
 */
export class StateManager {
  private readonly entries: Map<StateId, StateEntry> = new Map();

  /** Create a new empty manager, or seed it from a previous snapshot. */
  constructor(initial?: StateSnapshot) {
    if (initial !== undefined) {
      for (const [id, entry] of Object.entries(initial)) {
        assertId(id);
        this.entries.set(id, { ...entry, id, value: cloneValue(entry.value) });
      }
    }
  }

  /** Create a new entry. Throws if the id already exists. */
  create(id: StateId, value: StateValue): StateEntry {
    assertId(id);
    if (this.entries.has(id)) {
      throw new StateInvalidError(`State entry already exists: ${id}`);
    }
    const ts = now();
    const entry: StateEntry = {
      id,
      value: cloneValue(value),
      revision: 0,
      createdAt: ts,
      updatedAt: ts,
    };
    this.entries.set(id, entry);
    return clone(entry);
  }

  /** Read an entry. Throws `StateNotFoundError` when the id is unknown. */
  get(id: StateId): StateEntry;
  /** Read an entry, returning `undefined` instead of throwing when `optional`. */
  get(id: StateId, options: GetOptions & { optional: true }): StateEntry | undefined;
  get(id: StateId, options?: GetOptions): StateEntry | undefined {
    assertId(id);
    const entry = this.entries.get(id);
    if (entry) return clone(entry);
    if (options?.optional) return undefined;
    throw new StateNotFoundError(id);
  }

  /** Overwrite an entry's value wholesale. */
  set(id: StateId, value: StateValue): StateEntry {
    assertId(id);
    const existing = this.entries.get(id);
    if (!existing) throw new StateNotFoundError(id);
    existing.value = cloneValue(value);
    existing.revision += 1;
    existing.updatedAt = now();
    return clone(existing);
  }

  /** Shallow-merge a patch into an object-valued entry. */
  patch(id: StateId, patch: StatePatch): StateEntry {
    assertId(id);
    const existing = this.entries.get(id);
    if (!existing) throw new StateNotFoundError(id);
    const value = existing.value;
    if (value === null || typeof value !== 'object' || Array.isArray(value)) {
      throw new StateInvalidError(
        `Cannot patch non-object entry: ${id} (current type: ${value === null ? 'null' : typeof value})`
      );
    }
    existing.value = cloneValue({ ...value, ...patch });
    existing.revision += 1;
    existing.updatedAt = now();
    return clone(existing);
  }

  /**
   * Apply a pure transition. `current` is `undefined` for unknown ids,
   * which lets callers lazily initialize state. The current value is
   * deep-cloned before it reaches the transition, and the returned value
   * is cloned again before storage.
   */
  transition(id: StateId, transition: StateTransition): StateEntry {
    assertId(id);
    if (typeof transition !== 'function') {
      throw new StateInvalidError('transition must be a function');
    }
    const existing = this.entries.get(id);
    if (existing) {
      const next = transition(cloneValue(existing.value));
      return this.set(id, next);
    }
    const next = transition(undefined);
    return this.create(id, next);
  }

  /** Delete an entry. Returns false if it did not exist. */
  delete(id: StateId): boolean {
    assertId(id);
    return this.entries.delete(id);
  }

  /** True when the id exists. */
  has(id: StateId): boolean {
    assertId(id);
    return this.entries.has(id);
  }

  /** Number of tracked entries. */
  get size(): number {
    return this.entries.size;
  }

  /** Copy of the full snapshot; every entry and value is deep-cloned. */
  snapshot(): StateSnapshot {
    const out: StateSnapshot = {};
    for (const [id, entry] of this.entries) {
      out[id] = clone(entry);
    }
    return out;
  }

  /** List of ids, insertion-ordered. */
  ids(): StateId[] {
    return [...this.entries.keys()];
  }
}

export default StateManager;

// Re-export the error classes so consumers can import them from this module.
export { StateInvalidError, StateNotFoundError };
