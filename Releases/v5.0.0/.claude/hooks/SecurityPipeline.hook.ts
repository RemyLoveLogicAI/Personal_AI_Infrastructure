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
import { createGate } from './security/cockpit';

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

    case 'require_approval':
      // Fire-and-forget cockpit gate creation
      createGate('action', 'warning', input.agent_type ?? 'unknown', input.tool_name, result.reason ?? 'Approval required')
        .catch((e) => console.error('[cockpit] gate creation error:', String(e)))
      console.log(JSON.stringify({
        hookSpecificOutput: {
          hookEventName: 'PreToolUse',
          permissionDecision: 'ask',
          permissionDecisionReason: result.permissionDecisionReason,
        },
      }));
      break;

    case 'alert':
      console.error(`[PAI SECURITY] ⚠️ ALERT: ${result.reason}`);
      break;

    case 'allow':
      break;
  }
}

main().catch(() => process.exit(0));
