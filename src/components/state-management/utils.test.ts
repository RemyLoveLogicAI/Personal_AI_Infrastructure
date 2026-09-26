import { describe, expect, test } from 'bun:test';
import {
  deepEqual,
  diffSnapshot,
  mergePatch,
} from './utils';

describe('deepEqual', () => {
  test('primitives and identity', () => {
    expect(deepEqual(1, 1)).toBe(true);
    expect(deepEqual('a', 'a')).toBe(true);
    expect(deepEqual(null, null)).toBe(true);
    expect(deepEqual(1, 2)).toBe(false);
    expect(deepEqual('a', 'b')).toBe(false);
    expect(deepEqual(1, '1')).toBe(false);
  });

  test('objects and arrays', () => {
    expect(deepEqual({ a: [1, { b: 2 }] }, { a: [1, { b: 2 }] })).toBe(true);
    expect(deepEqual({ a: 1 }, { a: 1, b: 2 })).toBe(false);
    expect(deepEqual([1, 2], [1, 2, 3])).toBe(false);
    expect(deepEqual([1, 2], [2, 1])).toBe(false);
    expect(deepEqual([], [])).toBe(true);
  });
});

describe('mergePatch', () => {
  test('does not mutate inputs', () => {
    const current = { a: 1 };
    const result = mergePatch(current, { b: 2 });
    expect(result).toEqual({ a: 1, b: 2 });
    expect(current).toEqual({ a: 1 });
  });
});

describe('diffSnapshot', () => {
  test('computes added/removed/changed', () => {
    const mk = (value: unknown, revision = 0) =>
      ({
        id: 'x',
        value,
        revision,
        createdAt: 0,
        updatedAt: 0,
      }) as never;

    const before = {
      keep: mk(1),
      remove: mk(2),
      change: mk('old'),
    };
    const after = {
      keep: mk(1),
      change: mk('new', 1),
      add: mk(3),
    };

    expect(diffSnapshot(before, after)).toEqual({
      added: ['add'],
      removed: ['remove'],
      changed: ['change'],
    });
  });
});
