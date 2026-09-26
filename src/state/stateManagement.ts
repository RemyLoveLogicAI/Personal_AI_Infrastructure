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
  StateValue,
} from '../components/state-management/types';

/** Resolve the persistence path: env override > tmp default (Node-safe). */
function storagePath(): string {
  const override = process.env?.PAI_STATE_PATH;
  if (override && override.length > 0) return override;
  return path.join(os.tmpdir(), 'pai-state.json');
}

let globalStore: StateManager | null = null;

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

/** Persist the current snapshot as pretty-printed JSON. */
export function persistState(): void {
  fs.mkdirSync(path.dirname(storagePath()), { recursive: true });
  fs.writeFileSync(
    storagePath(),
    serializeSnapshot(getState().snapshot()),
    'utf8'
  );
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

  /** Create-or-overwrite a value and persist immediately. */
  set(id: StateId, value: StateValue): void {
    const manager = getState();
    if (manager.has(id)) {
      manager.set(id, value);
    } else {
      manager.create(id, value);
    }
    persistState();
  },

  /** Apply a pure transition (e.g. counters) and persist immediately. */
  update(
    id: StateId,
    transition: (current: StateValue | undefined) => StateValue
  ): void {
    getState().transition(id, transition);
    persistState();
  },

  /** Delete a value and persist immediately. */
  remove(id: StateId): void {
    getState().delete(id);
    persistState();
  },
};

export default state;
