/**
 * Root package.json test entry. Keeps `bun test` scoped to src/ so it
 * does not sweep pre-existing test files in Releases/ (cockpit.test.ts,
 * gates.test.ts), which are part of separate release trees.
 */
import { describe, expect, test } from 'bun:test';

describe('src/ test suite', () => {
  test('smoke: state management modules load and run', async () => {
    const { StateManager, StateNotFoundError } = await import(
      './src/components/state-management/index'
    );
    const sm = new StateManager();
    sm.create('ok', true);
    expect(sm.get('ok').value).toBe(true);
    expect(() => sm.get('missing')).toThrow(StateNotFoundError);
  });
});
