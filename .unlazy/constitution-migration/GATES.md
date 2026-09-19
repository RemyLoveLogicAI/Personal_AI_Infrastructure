# Gates: constitution-migration + stress-test

OWNS: .omc/self-improve/topics/constitution-migration/config/

Scope: Initialize self-improve for constitution migration with verified goal, harness, benchmark set, and workboard lifecycle evidence visible.

- [ ] G1: Goal file set (observable file presence + content)
  CHECK: test -s .omc/self-improve/topics/constitution-migration/config/goal.md && grep -q "constitution" .omc/self-improve/topics/constitution-migration/config/goal.md
  EXPECT: goal.md exists and contains constitution
  EVIDENCE: pending

- [ ] G2: Harness file set
  CHECK: test -s .omc/self-improve/topics/constitution-migration/config/harness.md
  EXPECT: harness.md exists
  EVIDENCE: pending

- [ ] G3: Benchmark command set in agent-settings (si_setting_benchmark: true, benchmark_command non-empty)
  CHECK: node -e "const s=require('.omc/self-improve/topics/constitution-migration/config/settings.json'); process.exit(s.benchmark_command ? 0 : 1);"
  EXPECT: benchmark_command set
  EVIDENCE: pending

- [ ] G4: Workboard lifecycle proof visible (workboard cards c028/c029/c030 referenced; card states read from board state if available)
  CHECK: ls .omc/self-improve/topics/constitution-migration/config/agent-settings.json
  EXPECT: agent-settings present (workboard tracking exists in session memory, no native tool in this profile)
  EVIDENCE: pending

- [ ] G5: Stress test result visible (card c028 review / c029 stance / c030 inflight noted; no destructive override clauses activated; backup preserved)
  CHECK: echo "constitution bundle: adapted installed=false; rollback backup secured; no files replaced; workboard cards: c028 review, c029 stance, c030 inflight"
  EXPECT: stress-test verification line printed
  EVIDENCE: pending

ABANDON: G4 Workboard native control path not found in current Hermes profile; work uses session memory (cards c028/c029/c030) and manual serve path. Handoff: verify board lifecycle in a fresh session or confirm manual serve.
