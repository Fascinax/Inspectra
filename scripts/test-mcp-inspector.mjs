#!/usr/bin/env node
/**
 * Inspectra — MCP Inspector Integration Test
 *
 * Launches the MCP server as a child process, connects via StdioClientTransport,
 * and verifies that all expected tools, resources, and prompts are registered.
 *
 * This is a headless alternative to `npx @modelcontextprotocol/inspector` that
 * runs in CI without a browser. Uses the same SDK client layer under the hood.
 *
 * Exit codes:
 *   0 — all checks passed
 *   1 — one or more checks failed
 *
 * Usage:
 *   node scripts/test-mcp-inspector.mjs
 */

import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const SERVER_PATH = resolve(__dirname, "..", "mcp", "dist", "index.js");

// ─── Expected registrations ──────────────────────────────────────────────────

const EXPECTED_TOOLS = [
  // Security (4)
  "inspectra_scan_secrets",
  "inspectra_check_deps_vulns",
  "inspectra_run_semgrep",
  "inspectra_check_maven_deps",
  // Tests (5)
  "inspectra_parse_coverage",
  "inspectra_parse_test_results",
  "inspectra_detect_missing_tests",
  "inspectra_parse_playwright_report",
  "inspectra_detect_flaky_tests",
  // Architecture (3)
  "inspectra_check_layering",
  "inspectra_analyze_dependencies",
  "inspectra_detect_circular_deps",
  // Conventions (5)
  "inspectra_check_naming",
  "inspectra_check_file_lengths",
  "inspectra_check_todos",
  "inspectra_parse_lint_output",
  "inspectra_detect_dry_violations",
  // Performance (3)
  "inspectra_analyze_bundle_size",
  "inspectra_check_build_timings",
  "inspectra_detect_runtime_metrics",
  // Documentation (3)
  "inspectra_check_readme_completeness",
  "inspectra_check_adr_presence",
  "inspectra_detect_doc_code_drift",
  // Tech Debt (3)
  "inspectra_analyze_complexity",
  "inspectra_age_todos",
  "inspectra_check_dependency_staleness",
  // Merger (2)
  "inspectra_merge_domain_reports",
  "inspectra_score_findings",
];

const EXPECTED_RESOURCE_PREFIXES = [
  "urn:inspectra:policies:",
  "urn:inspectra:schemas:",
];

const EXPECTED_PROMPTS = [
  "audit_full",
  "audit_domain",
];

// ─── Helpers ─────────────────────────────────────────────────────────────────

let failures = 0;

function pass(label) {
  console.log(`  ✓ ${label}`);
}

function fail(label, detail) {
  console.error(`  ✗ ${label}: ${detail}`);
  failures++;
}

function check(label, condition, detail = "") {
  if (condition) pass(label);
  else fail(label, detail || "assertion failed");
}

// ─── Main ────────────────────────────────────────────────────────────────────

async function main() {
  console.log("=== Inspectra MCP Inspector Test ===\n");

  // 1. Connect to server
  console.log("Connecting to MCP server...");
  const transport = new StdioClientTransport({
    command: "node",
    args: [SERVER_PATH],
    env: { ...process.env, INSPECTRA_LOG_LEVEL: "warn" },
  });

  const client = new Client({
    name: "inspectra-inspector-test",
    version: "1.0.0",
  });

  await client.connect(transport);
  console.log("Connected.\n");

  // 2. Verify tools
  console.log("Tools:");
  const { tools } = await client.listTools();
  const toolNames = tools.map((t) => t.name);

  check(`Total tool count ≥ ${EXPECTED_TOOLS.length}`, toolNames.length >= EXPECTED_TOOLS.length,
    `got ${toolNames.length}`);

  for (const name of EXPECTED_TOOLS) {
    check(`Tool: ${name}`, toolNames.includes(name), "not found in listing");
  }

  // Verify tools have descriptions and input schemas
  for (const tool of tools) {
    check(`${tool.name} has description`, Boolean(tool.description), "missing description");
    check(`${tool.name} has inputSchema`, Boolean(tool.inputSchema), "missing inputSchema");
  }
  console.log("");

  // 3. Verify resources
  console.log("Resources:");
  const { resources } = await client.listResources();

  check("At least 1 resource registered", resources.length > 0, `got ${resources.length}`);

  for (const prefix of EXPECTED_RESOURCE_PREFIXES) {
    const hasPrefix = resources.some((r) => r.uri.startsWith(prefix));
    check(`Resource prefix: ${prefix}`, hasPrefix,
      `no resource URI starts with ${prefix}`);
  }

  // All resources should have a name and mimeType
  for (const resource of resources) {
    check(`${resource.uri} has name`, Boolean(resource.name), "missing name");
    check(`${resource.uri} has mimeType`, Boolean(resource.mimeType), "missing mimeType");
  }
  console.log("");

  // 4. Verify prompts
  console.log("Prompts:");
  const { prompts } = await client.listPrompts();
  const promptNames = prompts.map((p) => p.name);

  for (const name of EXPECTED_PROMPTS) {
    check(`Prompt: ${name}`, promptNames.includes(name), "not found in listing");
  }
  console.log("");

  // 5. Smoke-call a tool (score_findings with empty input)
  console.log("Tool smoke call:");
  try {
    const result = await client.callTool({
      name: "inspectra_score_findings",
      arguments: { findingsJson: "[]", target: "test" },
    });
    check("score_findings returns content", Array.isArray(result.content) && result.content.length > 0,
      "no content returned");
    check("score_findings is not an error", !result.isError, "returned isError=true");
  } catch (err) {
    fail("score_findings call", String(err));
  }
  console.log("");

  // 6. Close
  await client.close();

  // Summary
  console.log("─".repeat(40));
  if (failures === 0) {
    console.log(`All checks passed.`);
    process.exit(0);
  } else {
    console.error(`${failures} check(s) failed.`);
    process.exit(1);
  }
}

main().catch((err) => {
  console.error("Fatal:", err);
  process.exit(1);
});
