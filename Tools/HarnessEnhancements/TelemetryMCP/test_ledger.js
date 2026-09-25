import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";

async function runTest() {
  const transport = new StdioClientTransport({
    command: "node",
    args: ["/Users/lovelogic/GitHub/Personal_AI_Infrastructure/Tools/HarnessEnhancements/TelemetryMCP/index.js"]
  });

  const client = new Client({ name: "test-client", version: "1.0.0" });
  await client.connect(transport);

  console.log("Connected to TelemetryMCP. Saving checkpoint...");

  await client.callTool({
    name: "ledger_checkpoint_save",
    arguments: {
      active_task: {
        id: "task-123",
        goal: "Test Universal Context Ledger handoff",
        status: "testing"
      },
      context_continuation: {
        handoff_summary: "Wrote the test script and verifying end-to-end.",
        blocked_on: "Waiting for test execution.",
        open_threads: []
      },
      shared_memory_pointers: ["features/harness-enhancements.md"]
    }
  });

  console.log("Checkpoint saved. Loading checkpoint...");
  
  const result = await client.callTool({
    name: "ledger_checkpoint_load",
    arguments: {}
  });

  console.log("Loaded checkpoint:", result.content[0].text);
  
  process.exit(0);
}

runTest().catch(console.error);
