/**
 * Core types for the dependency-free state management layer (PLAN.md Phase 2).
 *
 * Design goals, per the repo's own doctrine ("text over opaque storage",
 * minimal dependencies):
 * - No runtime dependencies. Nothing here needs zustand/immer/redux.
 * - Structural typing only: `State` is an extensible record, not a class.
 * - State transitions are pure functions applied atomically by `StateManager`.
 */

/** Unique identifier for a tracked state entry. */
export type StateId = string;

/** Raw state value — JSON-safe payloads only (no functions, class instances, or undefined). */
export type StateValue =
  | string
  | number
  | boolean
  | null
  | StateValue[]
  | { [key: string]: StateValue };

/** A single tracked state entry with lifecycle metadata. */
export interface StateEntry {
  /** Stable identifier, unique within a StateManager instance. */
  readonly id: StateId;
  /** The current value of the entry. */
  value: StateValue;
  /** Monotonically increasing revision counter; starts at 0 on creation. */
  revision: number;
  /** Epoch milliseconds when the entry was created. */
  createdAt: number;
  /** Epoch milliseconds when the entry was last updated. */
  updatedAt: number;
}

/** Shorthand for a full snapshot: entry id → entry. */
export type StateSnapshot = Record<StateId, StateEntry>;

/** A patch describing a shallow merge into an object-valued entry. All keys must have defined values. */
export type StatePatch = { [key: string]: StateValue };

/**
 * A pure transition function. Receives the current value (or `undefined`
 * if the entry does not exist yet) and returns the next value.
 */
export type StateTransition = (
  current: StateValue | undefined
) => StateValue;

/** Options for `StateManager.get`. */
export interface GetOptions {
  /** Return `undefined` instead of throwing when the id is unknown. */
  optional?: boolean;
}

/** Error thrown when a required state entry is missing. */
export class StateNotFoundError extends Error {
  constructor(public readonly id: StateId) {
    super(`State entry not found: ${id}`);
    this.name = 'StateNotFoundError';
  }
}

/** Error thrown on invalid arguments (empty id, bad transitions, etc.). */
export class StateInvalidError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'StateInvalidError';
  }
}
