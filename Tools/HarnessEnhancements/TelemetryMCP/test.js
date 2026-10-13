import { spawn } from 'child_process';
import fs from 'fs/promises';
import path from 'path';
import os from 'os';

const LEDGER_FILE = path.join(os.homedir(), ".agentsroom", "universal_ledger.json");
const MCP_PATH = path.join(process.cwd(), 'index.js');

async function runTests() {
  console.log('--- STARTING MCP STRESS TESTS ---');

  function sendRequest(proc, request) {
    return new Promise((resolve) => {
      const onData = (data) => {
        const str = data.toString();
        try {
          const parsed = JSON.parse(str);
          if (parsed.id === request.id) {
            proc.stdout.removeListener('data', onData);
            resolve(parsed);
          }
        } catch (e) {
          // ignore non-json
        }
      };
      proc.stdout.on('data', onData);
      proc.stdin.write(JSON.stringify(request) + '\n');
    });
  }

  // 1. Failure Decoupling Test (Dashboard Offline)
  console.log('\n[TEST 1] Failure Decoupling (Circuit Breaker)');
  const proc1 = spawn('node', [MCP_PATH]);
  
  const t1_start = Date.now();
  const req1 = {
    jsonrpc: "2.0", id: 1, method: "tools/call",
    params: {
      name: "telemetry_set_status",
      arguments: { agent: "TestAgent", status: "online" }
    }
  };
  const res1 = await sendRequest(proc1, req1);
  const t1_duration = Date.now() - t1_start;
  
  if (res1.result && res1.result.content && t1_duration < 400) {
    console.log(`✅ Passed: Agent received instant success in ${t1_duration}ms despite Dashboard being offline.`);
  } else {
    console.error(`❌ Failed: Tool blocked or failed. Duration: ${t1_duration}ms`, res1);
  }
  proc1.kill();

  // 2. Context Ledger Schema Enforcement
  console.log('\n[TEST 2] Schema Corruption Resilience');
  await fs.mkdir(path.dirname(LEDGER_FILE), { recursive: true });
  await fs.writeFile(LEDGER_FILE, "{ corrupted json: 'yes'");
  
  const proc2 = spawn('node', [MCP_PATH]);
  const req2b = {
    jsonrpc: "2.0", id: 3, method: "tools/call",
    params: { name: "ledger_checkpoint_load", arguments: {} }
  };
  const res2b = await sendRequest(proc2, req2b);
  if (res2b.result && res2b.result.content) {
    console.log(`✅ Passed: Server successfully processed load request despite previously corrupted file.`);
  } else {
    console.error(`❌ Failed: Server failed to process load`, res2b);
  }
  proc2.kill();

  // 3. The Universal Handoff (Integration)
  console.log('\n[TEST 3] Universal Context Handoff');
  const proc3 = spawn('node', [MCP_PATH]);
  
  const handoffReq = {
    jsonrpc: "2.0", id: 4, method: "tools/call",
    params: {
      name: "ledger_checkpoint_save",
      arguments: {
        active_task: { id: "test-456", goal: "Fix the auth bug", status: "in_progress" },
        context_continuation: { handoff_summary: "Done part A", blocked_on: "Waiting for API key", open_threads: [] }
      }
    }
  };
  await sendRequest(proc3, handoffReq);
  proc3.kill();
  
  const proc4 = spawn('node', [MCP_PATH]);
  const loadReq = {
    jsonrpc: "2.0", id: 5, method: "tools/call",
    params: { name: "ledger_checkpoint_load", arguments: { task_id: "test-456" } }
  };
  const resLoad = await sendRequest(proc4, loadReq);
  
  const contentJSON = JSON.parse(resLoad.result.content[0].text);
  if (contentJSON.active_task && contentJSON.active_task.goal === "Fix the auth bug" && contentJSON.context_continuation.blocked_on === "Waiting for API key") {
    console.log(`✅ Passed: Agent B successfully read Agent A's state from the Universal Ledger.`);
  } else {
    console.error(`❌ Failed: Context did not match`, contentJSON);
  }
  proc4.kill();

  console.log('\n--- TESTS COMPLETE ---');
}

runTests().catch(console.error);
