/**
 * Global state store (PLAN.md Phase 2 / 3).
 *
 * Dependency-free replacement for the broken zustand scaffold ("state-storage"
 * localStorage store): a lazily created singleton `StateManager` with
 * JSON-file persistence, following the repo's "text over opaque storage"
 * doctrine.
 */

import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import {
  deserializeSnapshot,
  serializeSnapshot,
} from '../components/state-management/index';
import { StateManager } from '../components/state-management/StateManager';
import type {
  StateId,
  StateSnapshot,
  StateValue,
} from '../components/state-management/types';

/** Resolve the persistence path: env override > tmp default (Node-safe). */
function storagePath(): string {
  const override = process.env?.PAI_STATE_PATH;
  if (override && override.length > 0) return override;
  return path.join(os.tmpdir(), 'pai-state.json');
}

let globalStore: StateManager | null = null;

/**
 * Persist `snapshot` atomically: write to a temp file in the same directory,
 * then rename over the target. A crash mid-write can never leave a partial
 * store file behind.
 */
function persistSnapshot(snapshot: StateSnapshot): void {
  const target = storagePath();
  fs.mkdirSync(path.dirname(target), { recursive: true });
  const tmp = `${target}.tmp`;
  fs.writeFileSync(tmp, serializeSnapshot(snapshot), 'utf8');
  fs.renameSync(tmp, target);
}

/** Get the process-wide shared store, loading persisted state on first use. */
export function getState(): StateManager {
  if (globalStore === null) {
    let initial;
    try {
      initial = deserializeSnapshot(fs.readFileSync(storagePath(), 'utf8'));
    } catch {
      initial = undefined; // missing or corrupt file → start empty
    }
    globalStore = new StateManager(initial);
  }
  return globalStore;
}

/** Persist the current snapshot as pretty-printed JSON (atomic write). */
export function persistState(): void {
  persistSnapshot(getState().snapshot());
}

/** Reset the shared store to empty in memory (does not touch disk). */
export function resetState(): void {
  globalStore = new StateManager();
}

/** Drop the in-memory store so the next access reloads from disk. */
export function reloadState(): void {
  globalStore = null;
}

/** Typed convenience wrappers around the shared store. */
export const state = {
  /** Read a value with fallback, never throwing. */
  get(id: StateId, fallback?: StateValue): StateValue | undefined {
    const entry = getState().get(id, { optional: true });
    return entry ? entry.value : fallback;
  },

  /** Create-or-overwrite a value and persist immediately (rolls back on persist failure). */
  set(id: StateId, value: StateValue): void {
    const manager = getState();
    const existed = manager.has(id);
    const previous = existed ? manager.get(id) : undefined;
    if (existed) {
      manager.set(id, value);
    } else {
      manager.create(id, value);
    }
    try {
      persistSnapshot(manager.snapshot());
    } catch (err) {
      // Roll the in-memory store back so memory and disk cannot diverge (QA-004).
      if (existed && previous) manager.set(id, previous.value);
      else manager.delete(id);
      throw err;
    }
  },

  /** Apply a pure transition (e.g. counters) and persist immediately (rolls back on persist failure). */
  update(
    id: StateId,
    transition: (current: StateValue | undefined) => StateValue
  ): void {
    const manager = getState();
    const existed = manager.has(id);
    const previous = existed ? manager.get(id) : undefined;
    manager.transition(id, transition);
    try {
      persistSnapshot(manager.snapshot());
    } catch (err) {
      if (existed && previous) manager.set(id, previous.value);
      else manager.delete(id);
      throw err;
    }
  },

  /** Delete a value and persist immediately (rolls back on persist failure). */
  remove(id: StateId): void {
    const manager = getState();
    const existed = manager.has(id);
    const previous = existed ? manager.get(id) : undefined;
    manager.delete(id);
    try {
      persistSnapshot(manager.snapshot());
    } catch (err) {
      if (existed && previous) manager.set(id, previous.value);
      else manager.delete(id);
      throw err;
    }
  },
};

export default state;
