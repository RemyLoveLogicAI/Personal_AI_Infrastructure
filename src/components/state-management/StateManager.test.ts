import { describe, expect, test } from 'bun:test';
import {
  StateInvalidError,
  StateNotFoundError,
  StateManager,
} from './StateManager';

describe('StateManager', () => {
  test('creates and reads entries with lifecycle metadata', () => {
    const sm = new StateManager();
    const entry = sm.create('user:name', 'ada');

    expect(entry.value).toBe('ada');
    expect(entry.revision).toBe(0);
    expect(sm.has('user:name')).toBe(true);
    expect(sm.get('user:name').value).toBe('ada');
  });

  test('set increments revision and preserves createdAt', () => {
    const sm = new StateManager();
    const created = sm.create('counter', 0);
    const updated = sm.set('counter', 42);

    expect(updated.revision).toBe(1);
    expect(updated.createdAt).toBe(created.createdAt);
    expect(updated.value).toBe(42);
    expect(sm.get('counter', { optional: true })?.revision).toBe(1);
  });

  test('get throws typed StateNotFoundError for missing ids', () => {
    const sm = new StateManager();
    expect(() => sm.get('nope')).toThrow(StateNotFoundError);
    expect(sm.get('nope', { optional: true })).toBeUndefined();
  });

  test('create rejects duplicate ids', () => {
    const sm = new StateManager();
    sm.create('x', 1);
    expect(() => sm.create('x', 2)).toThrow(StateInvalidError);
  });

  test('patch shallow-merges object entries', () => {
    const sm = new StateManager();
    sm.create('profile', { name: 'ada', role: 'engineer' });
    const patched = sm.patch('profile', { role: 'founder' });

    expect(patched.value).toEqual({ name: 'ada', role: 'founder' });
    expect(patched.revision).toBe(1);
  });

  test('patch rejects non-object entries', () => {
    const sm = new StateManager();
    sm.create('num', 5);
    expect(() => sm.patch('num', { a: 1 })).toThrow(StateInvalidError);

    sm.create('arr', [1, 2]);
    expect(() => sm.patch('arr', { a: 1 })).toThrow(StateInvalidError);

    sm.create('nil', null);
    expect(() => sm.patch('nil', { a: 1 })).toThrow(StateInvalidError);
  });

  test('transition applies pure functions atomically', () => {
    const sm = new StateManager();
    sm.create('count', 0);
    sm.transition('count', (n) => (n as number) + 1);
    const result = sm.transition('count', (n) => (n as number) + 10);

    expect(result.value).toBe(11);
    expect(result.revision).toBe(2);
  });

  test('transition lazily initializes unknown ids', () => {
    const sm = new StateManager();
    const entry = sm.transition('lazy', (current) => current ?? 'seed');

    expect(entry.value).toBe('seed');
    expect(entry.revision).toBe(0);
  });

  test('transition rejects non-function arguments', () => {
    const sm = new StateManager();
    expect(() => sm.transition('x', 42 as never)).toThrow(StateInvalidError);
  });

  test('delete removes entries and reports existence', () => {
    const sm = new StateManager();
    sm.create('gone', true);
    expect(sm.delete('gone')).toBe(true);
    expect(sm.delete('gone')).toBe(false);
    expect(sm.has('gone')).toBe(false);
  });

  test('rejects invalid ids everywhere', () => {
    const sm = new StateManager();
    expect(() => sm.create('', 1)).toThrow(StateInvalidError);
    expect(() => sm.get(123 as never)).toThrow(StateInvalidError);
    expect(() => sm.set('', 1)).toThrow(StateInvalidError);
  });

  test('snapshot round-trips through a new manager', () => {
    const sm = new StateManager();
    sm.create('a', { nested: [1, 2] });
    sm.set('a', { nested: [3] });

    const snap = sm.snapshot();
    const restored = new StateManager(snap);

    expect(restored.size).toBe(1);
    expect(restored.get('a').value).toEqual({ nested: [3] });
    expect(restored.get('a').revision).toBe(1);
  });

  test('returned entries are clones, not live references', () => {
    const sm = new StateManager();
    const entry = sm.create('obj', { inner: 1 });
    (entry.value as { inner: number }).inner = 999;

    expect(sm.get('obj').value).toEqual({ inner: 1 });
  });

  test('snapshot returns cloned entries too', () => {
    const sm = new StateManager();
    sm.create('obj', { inner: 1 });
    const snap = sm.snapshot();
    const snapEntry = snap['obj']!;
    (snapEntry.value as { inner: number }).inner = 999;

    expect(sm.get('obj').value).toEqual({ inner: 1 });
  });
});
