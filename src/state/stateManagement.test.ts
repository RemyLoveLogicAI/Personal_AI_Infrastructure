import { afterEach, beforeEach, describe, expect, spyOn, test } from 'bun:test';
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import {
  getState,
  persistState,
  reloadState,
  resetState,
  state,
} from './stateManagement';

let tmpDir: string;
let originalPath: string | undefined;

beforeEach(() => {
  originalPath = process.env.PAI_STATE_PATH;
  tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'pai-state-test-'));
  process.env.PAI_STATE_PATH = path.join(tmpDir, 'state.json');
  resetState();
});

afterEach(() => {
  if (originalPath === undefined) delete process.env.PAI_STATE_PATH;
  else process.env.PAI_STATE_PATH = originalPath;
  fs.rmSync(tmpDir, { recursive: true, force: true });
});

describe('state (persisted global store)', () => {
  test('set persists to disk and survives a reload', () => {
    state.set('user:name', 'ada');

    reloadState(); // simulate a fresh process
    expect(state.get('user:name')).toBe('ada');
  });

  test('set overwrites existing values', () => {
    state.set('counter', 1);
    state.set('counter', 2);

    reloadState();
    expect(state.get('counter')).toBe(2);
  });

  test('update applies transitions and persists the result', () => {
    state.update('count', (n) => ((n as number | undefined) ?? 0) + 1);
    state.update('count', (n) => ((n as number | undefined) ?? 0) + 10);

    reloadState();
    expect(state.get('count')).toBe(11);
  });

  test('remove deletes values and persists the deletion', () => {
    state.set('gone', true);
    state.remove('gone');

    reloadState();
    expect(state.get('gone')).toBeUndefined();
  });

  test('get returns the fallback for missing ids', () => {
    expect(state.get('missing', 'default')).toBe('default');
  });

  test('corrupt store file starts empty instead of crashing', () => {
    fs.writeFileSync(process.env.PAI_STATE_PATH as string, '{not valid json');

    reloadState();
    expect(getState().size).toBe(0);
  });

  test('persistState round-trips the full snapshot', () => {
    state.set('a', { nested: [1, 2] });
    state.set('b', 'plain');

    persistState();

    reloadState();
    expect(state.get('a')).toEqual({ nested: [1, 2] });
    expect(state.get('b')).toBe('plain');
  });

  test('persistState writes valid JSON even for an empty store', () => {
    persistState();
    const raw = fs.readFileSync(process.env.PAI_STATE_PATH as string, 'utf8');
    expect(JSON.parse(raw)).toEqual({});
  });

  test('loads a valid-JSON but invalid-shape file as an empty store (QA-002)', () => {
    // Valid JSON, but not a valid StateSnapshot: value is a bare number.
    fs.writeFileSync(process.env.PAI_STATE_PATH as string, '{"a": 42}', 'utf8');

    reloadState();
    expect(getState().size).toBe(0);
    expect(state.get('a')).toBeUndefined();
  });

  test('rejects snapshot files whose entries are missing lifecycle fields (QA-002)', () => {
    // Entry missing value/revision/createdAt/updatedAt entirely.
    fs.writeFileSync(
      process.env.PAI_STATE_PATH as string,
      '{"a": {"id": "a"}}',
      'utf8'
    );

    reloadState();
    expect(getState().size).toBe(0);
  });

  test('a persisted snapshot still reloads after shape validation (QA-002)', () => {
    state.set('ok', { nested: [1] });
    persistState();

    reloadState();
    expect(state.get('ok')).toEqual({ nested: [1] });
  });

  test('a failed persist does not leave the in-memory store updated (QA-004)', () => {
    state.set('stable', 'before');

    const writeSpy = spyOn(fs, 'writeFileSync').mockImplementation(() => {
      throw new Error('disk full (simulated)');
    });
    try {
      expect(() => state.set('stable', 'after')).toThrow('disk full');
    } finally {
      writeSpy.mockRestore();
    }

    // In-memory store must be unchanged; disk still holds the previous value.
    expect(state.get('stable')).toBe('before');
  });
});
