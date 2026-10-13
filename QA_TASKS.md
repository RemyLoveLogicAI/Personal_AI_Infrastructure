# QA Task Registry — `security/hardening-pass-1` (state management)

QA pass on 2026-09-25. Baseline: `bun run verify` green (26/26), then 6 probe
tests confirmed 4 defects. Registry below tracks remediation. Statuses:
`open` → `in-progress` → `fixed-verified`. Probes were throwaway (`qa-probe.test.ts`,
deleted); each task graduates its finding into a permanent regression test.

| ID | Severity | Component | Finding | Status |
| --- | --- | --- | --- | --- |
| QA-001 | High | `utils.ts` `diffSnapshot` | Reference comparison (`prev.value !== next.value`) marks cloned-but-identical object/array values as changed → false-positive diffs for any change-detection/persistence-skip consumer. | fixed-verified |
| QA-002 | High | `stateManagement.ts` load path | Persisted file that is valid JSON but not a valid snapshot (`{"a": 42}`) loads a broken entry with `value: undefined` instead of starting empty. Corrupt-file recovery only covers unparseable JSON. | fixed-verified |
| QA-003 | Medium | `StateManager` write path | JSON-safety contract is documented but unenforced: `patch` with explicit `undefined` drops keys (data loss on round-trip), `set(NaN)` silently becomes `null` on persist, `transition(() => undefined)` stores literal `undefined`. | fixed-verified |
| QA-004 | Low | `stateManagement.ts` `state.update/set` | Memory/disk divergence: transition can lazily create an entry, then persist can fail → in-memory store has the value, disk does not, and nothing reports it. | fixed-verified |

## Acceptance criteria

- QA-001: `diffSnapshot` between two snapshots of an unchanged store returns
  `{added: [], removed: [], changed: []}`; value-level change on an object
  entry is still detected; array reordering is detected.
- QA-002: a file containing `{"a": 42}` loads as an empty store; a snapshot
  missing `value`/`revision`/`createdAt`/`updatedAt` is rejected (store starts
  empty); valid snapshots load unchanged.
- QA-003: `set/create/patch/transition` with non-JSON-safe values (explicit
  `undefined` patch key, `NaN`, transition returning `undefined`) throw
  `StateInvalidError` and leave the store unchanged.
- QA-004: `persistState` uses write-to-temp + atomic rename; a persist failure
  inside `state.update`/`state.set` leaves the in-memory store unchanged
  (entry absent / previous value preserved).

## Remediation log (2026-09-25)

- QA-001 → `diffSnapshot` now compares values with `deepEqual` (structural),
  not identity. Tests: `utils.test.ts` QA-001 ×2.
- QA-002 → `deserializeSnapshot` validates every entry (string id matching
  its key, numeric revision/createdAt/updatedAt, JSON-safe value) and throws
  `StateInvalidError` on shape violations; `getState()` catches and starts
  empty. Tests: `stateManagement.test.ts` QA-002 ×3.
- QA-003 → `assertJsonValue`/`isJsonValue` added to `utils.ts`; enforced in
  `create`, `set`, `patch` (whole patch object), and `transition` (return
  value, before mutation). Tests: `StateManager.test.ts` QA-003 ×3.
- QA-004 → persistence now writes to `state.json.tmp` then renames (atomic);
  `state.set/update/remove` roll back the in-memory change when persist
  throws. Tests: `stateManagement.test.ts` QA-004 ×1.

**Verification:** red phase confirmed (7 fail / 28 pass), then
`bun run verify` → typecheck clean, **35 pass / 0 fail** (26 original + 9
regression tests, 69 expect calls).

## Process

1. Write regression tests per task (red phase, expect failures).
2. Apply the minimal fix.
3. `bun run verify` — all tests green (old + new).
4. Mark `fixed-verified` with the evidence line.
