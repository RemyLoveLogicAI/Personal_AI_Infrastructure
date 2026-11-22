#!/usr/bin/env bun
/**
- task
- task
- task
- task
- task
- task
- task
- task
- task
- task
- task
- task
- task
- task
- task
- task
- task
- task
- task
- task
- task
- task
- task
- task
- task
- task
- task
- task
- task
- task
- task
- task
- task
- task
- task
- task
- task
- task
- task
- task
- task
- task
- task
- task
- task
- task
- task
- task
- task
- task
- task
- task
- task
- task
- task
- task
- task
- task
- task
- task
- task
- task
- task
- task
- task
- task
- task
- task
- task
- task
- task
- task
- task
- task
- task
- task
- task
- task
- task
- task
- task
- task
- task
- task
- task
- task
- task
- task
- task
- task
- task
- task
- task
- task
- task
- task
- task
- task
- task
- task
- task
- task
- task
- task
- task
- task
- task
- task
- task
- task
- task
- task
- task
- task
- task
- task
- task
- task
- task
- task
- task
- task
- task
- task
- task
- task
- task
- task
- task
- task
- task
 * SecurityPipeline.hook.ts — PreToolUse entry point
 *
 * Runs the inspector pipeline on every Bash, Write, Edit, and MultiEdit
 * tool call. Replaces the old SecurityValidator.hook.ts with a composable
 * inspector chain: Pattern → Egress → Rules.
 *
 * TRIGGER: PreToolUse (matcher: Bash, Write, Edit, MultiEdit)
 */

import type { InspectionContext } from './security/types';
import { InspectorPipeline } from './security/pipeline';
import { createPatternInspector } from './security/inspectors/PatternInspector';
import { createEgressInspector } from './security/inspectors/EgressInspector';
import { createRulesInspector } from './security/inspectors/RulesInspector';
import { createGate, checkGate, fingerprintFor } from './security/cockpit';

interface HookInput {
  session_id: string;
  tool_name: string;
  tool_input: Record<string, unknown> | string;
  agent_type?: string;
}

const pipeline = new InspectorPipeline([
  createPatternInspector(),
  createEgressInspector(),
  createRulesInspector(),
]);

async function main(): Promise<void> {
  let input: HookInput;

  try {
    const { readFileSync } = await import('fs');
    const raw = readFileSync('/dev/stdin', 'utf-8');
    if (!raw.trim()) return;
    input = JSON.parse(raw);
  } catch {
    return; // Parse error → fail open
  }

  const ctx: InspectionContext = {
    sessionId: input.session_id,
    toolName: input.tool_name,
    toolInput: input.tool_input,
    agent_type: input.agent_type,
  };

  const result = await pipeline.run(ctx);

  switch (result.action) {
    case 'deny':
      console.error(`[PAI SECURITY] 🚨 BLOCKED: ${result.reason}`);
      process.exit(2);
      break;

    case 'require_approval': {
      // The gate bus is authoritative: a cockpit approval lets this exact
      // action through once, a recent denial blocks it outright, and an
      // undecided gate falls back to prompting.
      const fingerprint = fingerprintFor(input.tool_name, input.tool_input);
      const decision = await checkGate(fingerprint);

      if (decision === 'deny') {
        console.error('[PAI SECURITY] 🚫 DENIED by cockpit: ' + (result.reason ?? 'recently denied'));
        process.exit(2);
        break;
      }

      if (decision === 'allow') {
        console.error('[PAI SECURITY] ✅ approved by cockpit — allowing once');
        break;
      }

      // Undecided: record the gate (fire-and-forget) and prompt.
      createGate('action', 'warning', input.agent_type ?? 'unknown', input.tool_name,
        result.reason ?? 'Approval required', fingerprint)
        .catch((e) => console.error('[cockpit] gate creation error:', String(e)))
      console.log(JSON.stringify({
        hookSpecificOutput: {
          hookEventName: 'PreToolUse',
          permissionDecision: 'ask',
          permissionDecisionReason: result.permissionDecisionReason,
        },
      }));
      break;
    }

    case 'alert':
      console.error(`[PAI SECURITY] ⚠️ ALERT: ${result.reason}`);
      break;

    case 'allow':
      break;
  }
}

main().catch(() => process.exit(0));
