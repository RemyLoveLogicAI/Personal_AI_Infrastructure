import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";
import assert from "node:assert/strict";

async function runTest() {
  const transport = new StdioClientTransport({
    command: "node",
    args: ["/Users/lovelogic/GitHub/Personal_AI_Infrastructure/Tools/HarnessEnhancements/TelemetryMCP/index.js"]
  });

  const client = new Client({ name: "test-client", version: "1.0.0" });
  await client.connect(transport);

  console.log("Connected to TelemetryMCP. Testing user-centric tools...");

  // 1. Set & Get User Intent
  console.log("1. Testing telemetry_set_user_intent & telemetry_get_user_intent...");
  await client.callTool({
    name: "telemetry_set_user_intent",
    arguments: {
      focus: "Autonomous Life OS Scaling",
      telos: "Maximized individual agency through reliable AI orchestration",
      priorities: ["Preserve stability", "Zero-friction guidance"]
    }
  });

  const intentRes = await client.callTool({
    name: "telemetry_get_user_intent",
    arguments: {}
  });
  const parsedIntent = JSON.parse(intentRes.content[0].text);
  assert.equal(parsedIntent.focus, "Autonomous Life OS Scaling");
  console.log("   Intent verified successfully.");

  // 2. Request & Resolve Guidance
  console.log("2. Testing telemetry_request_guidance & telemetry_resolve_guidance...");
  const guideReq = await client.callTool({
    name: "telemetry_request_guidance",
    arguments: {
      agent: "Claude Code",
      question: "Should we deploy the new dashboard HUD to staging or production?",
      options: ["Staging", "Production"],
      context: "Validation tests passed."
    }
  });
  const guideText = guideReq.content[0].text;
  const match = guideText.match(/\[(guidance-[^\]]+)\]/);
  assert.ok(match, "Guidance ID should be returned");
  const guidanceId = match[1];

  await client.callTool({
    name: "telemetry_resolve_guidance",
    arguments: {
      id: guidanceId,
      resolution: "Proceed to Staging first."
    }
  });
  console.log("   Guidance request and resolution verified successfully.");

  // 3. Report Milestone
  console.log("3. Testing telemetry_report_milestone...");
  const milestoneRes = await client.callTool({
    name: "telemetry_report_milestone",
    arguments: {
      agent: "AgentsOrchestrator",
      title: "Universal User-Centric Bridge Integrated",
      description: "Added guidance, milestones, and intent synchronization across harnesses.",
      category: "architecture",
      artifacts: ["Tools/HarnessEnhancements/TelemetryMCP/index.js"]
    }
  });
  assert.ok(milestoneRes.content[0].text.includes("Universal User-Centric Bridge Integrated"));
  console.log("   Milestone verified successfully.");

  console.log("ALL USER-CENTRIC MCP TOOLS PASSED!");
  process.exit(0);
}

runTest().catch(err => {
  console.error(err);
  process.exit(1);
});
