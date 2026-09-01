#!/usr/bin/env node
/**
 * E2E smoke test for the MCP server over real stdio.
 * Spawns `npx tsx mcp/server.ts`, performs the MCP handshake,
 * lists tools, and calls analyze-repo with a real repository.
 *
 * Usage: node scripts/e2e-mcp.mjs [repoUrl]
 */

import { spawn } from "node:child_process";

const REPO_URL = process.argv[2] ?? "https://github.com/VinuthaKiran-07/RepoPulse-Lite-";
let nextId = 1;

function encode(msg) {
  return JSON.stringify(msg) + "\n";
}

const child = spawn("npx", ["tsx", "mcp/server.ts"], {
  cwd: new URL("..", import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, "$1"),
  stdio: ["pipe", "pipe", "pipe"],
  shell: process.platform === "win32",
});

const pending = new Map();
let buffer = "";

child.stdout.on("data", (chunk) => {
  buffer += chunk.toString();
  let idx;
  while ((idx = buffer.indexOf("\n")) !== -1) {
    const line = buffer.slice(0, idx).trim();
    buffer = buffer.slice(idx + 1);
    if (line.length === 0) continue;
    try {
      const msg = JSON.parse(line);
      if (msg.id !== undefined && pending.has(msg.id)) {
        pending.get(msg.id)(msg);
        pending.delete(msg.id);
      }
    } catch {
      console.log(`[server stderr->stdout?] ${line}`);
    }
  }
});

child.stderr.on("data", (chunk) => {
  const text = chunk.toString().trim();
  if (text) console.log(`[server] ${text}`);
});

function rpc(method, params) {
  const id = nextId++;
  const msg = { jsonrpc: "2.0", id, method, params };
  return new Promise((resolve, reject) => {
    pending.set(id, (reply) => {
      if (reply.error) {
        reject(new Error(JSON.stringify(reply.error)));
      } else {
        resolve(reply.result);
      }
    });
    child.stdin.write(encode(msg));
  });
}

const timeout = setTimeout(() => {
  console.error("MCP E2E timed out");
  child.kill();
  process.exit(1);
}, 240000);

try {
  const init = await rpc("initialize", {
    protocolVersion: "2024-11-05",
    capabilities: {},
    clientInfo: { name: "e2e-smoke", version: "1.0.0" },
  });
  console.log("PASS  initialize handshake");
  console.log(`      server: ${init.serverInfo.name} v${init.serverInfo.version}`);

  child.stdin.write(encode({ jsonrpc: "2.0", method: "notifications/initialized" }));

  const tools = await rpc("tools/list", {});
  const names = tools.tools.map((t) => t.name);
  console.log(`PASS  tools/list returned ${names.length} tool(s): ${names.join(", ")}`);
  if (!names.includes("analyze-repo")) {
    throw new Error(`analyze-repo tool missing; got ${names.join(", ")}`);
  }
  console.log("PASS  analyze-repo tool registered");

  const call = await rpc("tools/call", {
    name: "analyze-repo",
    arguments: { repoUrl: REPO_URL },
  });

  const text = call.content?.[0]?.text;
  if (typeof text !== "string") {
    throw new Error("tool result missing text content");
  }
  const payload = JSON.parse(text);
  if (typeof payload.score !== "number" || payload.score < 0 || payload.score > 100) {
    throw new Error(`unexpected score: ${payload.score}`);
  }
  console.log(`PASS  analyze-repo call returned score=${payload.score} band=${payload.band?.band} commits=${payload.commits?.length}`);

  const errCall = await rpc("tools/call", {
    name: "analyze-repo",
    arguments: { repoUrl: "https://evil.com/owner/repo" },
  });
  const errText = errCall.content?.[0]?.text;
  const errPayload = JSON.parse(errText);
  if (errCall.isError !== true || errPayload.error?.code !== "INVALID_URL") {
    throw new Error(`expected INVALID_URL error, got: ${errText.slice(0, 120)}`);
  }
  console.log("PASS  analyze-repo rejects invalid URL with structured error");

  console.log("\nMCP E2E RESULT: all checks passed");
  child.stdin.end();
  child.kill();
  clearTimeout(timeout);
  process.exit(0);
} catch (err) {
  console.error(`MCP E2E FAILED: ${err.message}`);
  child.kill();
  clearTimeout(timeout);
  process.exit(1);
}
