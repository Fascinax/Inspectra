import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { scanSecrets, checkDependencyVulnerabilities } from "./tools/security.js";
import { parseCoverage, parseTestResults, detectMissingTests } from "./tools/tests.js";
import { checkLayering, analyzeModuleDependencies } from "./tools/architecture.js";
import { checkNamingConventions, checkFileLengths, checkTodoFixmes } from "./tools/code-quality.js";
import { mergeReports } from "./merger/merge-findings.js";
import { scoreDomain } from "./merger/score.js";
import { loadAllPolicies } from "./policies/loader.js";
import { DomainReportSchema, FindingSchema } from "./types.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const POLICIES_DIR = resolve(__dirname, "..", "..", "policies");

const server = new McpServer({
  name: "inspectra",
  version: "0.1.0",
});

// ─── Security Tools ─────────────────────────────────────────────────────────

server.tool(
  "scan-secrets",
  "Scan source files for hardcoded secrets, API keys, and credentials",
  { filePathsCsv: z.string().describe("Comma-separated absolute paths to files to scan") },
  async ({ filePathsCsv }) => {
    const filePaths = filePathsCsv.split(",").map((p) => p.trim()).filter(Boolean);
    const findings = await scanSecrets(filePaths);
    return { content: [{ type: "text", text: JSON.stringify(findings, null, 2) }] };
  }
);

server.tool(
  "check-deps-vulns",
  "Run npm audit to find vulnerable dependencies",
  { projectDir: z.string().describe("Absolute path to the project root") },
  async ({ projectDir }) => {
    const findings = await checkDependencyVulnerabilities(projectDir);
    return { content: [{ type: "text", text: JSON.stringify(findings, null, 2) }] };
  }
);

// ─── Test Tools ─────────────────────────────────────────────────────────────

server.tool(
  "parse-coverage",
  "Parse coverage reports and flag metrics below thresholds",
  { projectDir: z.string().describe("Absolute path to the project root") },
  async ({ projectDir }) => {
    const findings = await parseCoverage(projectDir);
    return { content: [{ type: "text", text: JSON.stringify(findings, null, 2) }] };
  }
);

server.tool(
  "parse-test-results",
  "Parse JUnit XML test results and report failures",
  { projectDir: z.string().describe("Absolute path to the project root") },
  async ({ projectDir }) => {
    const findings = await parseTestResults(projectDir);
    return { content: [{ type: "text", text: JSON.stringify(findings, null, 2) }] };
  }
);

server.tool(
  "detect-missing-tests",
  "Detect source files that lack a corresponding test file",
  { projectDir: z.string().describe("Absolute path to the project root") },
  async ({ projectDir }) => {
    const findings = await detectMissingTests(projectDir);
    return { content: [{ type: "text", text: JSON.stringify(findings, null, 2) }] };
  }
);

// ─── Architecture Tools ─────────────────────────────────────────────────────

server.tool(
  "check-layering",
  "Verify clean architecture layer dependencies (presentation → application → domain ← infrastructure)",
  { projectDir: z.string().describe("Absolute path to the project root") },
  async ({ projectDir }) => {
    const findings = await checkLayering(projectDir);
    return { content: [{ type: "text", text: JSON.stringify(findings, null, 2) }] };
  }
);

server.tool(
  "analyze-dependencies",
  "Analyze package.json dependencies for excessive count or duplication",
  { projectDir: z.string().describe("Absolute path to the project root") },
  async ({ projectDir }) => {
    const findings = await analyzeModuleDependencies(projectDir);
    return { content: [{ type: "text", text: JSON.stringify(findings, null, 2) }] };
  }
);

// ─── Code Quality Tools ─────────────────────────────────────────────────────

server.tool(
  "check-naming",
  "Verify file and class naming conventions",
  { projectDir: z.string().describe("Absolute path to the project root") },
  async ({ projectDir }) => {
    const findings = await checkNamingConventions(projectDir);
    return { content: [{ type: "text", text: JSON.stringify(findings, null, 2) }] };
  }
);

server.tool(
  "check-file-lengths",
  "Flag files exceeding length thresholds",
  { projectDir: z.string().describe("Absolute path to the project root") },
  async ({ projectDir }) => {
    const findings = await checkFileLengths(projectDir);
    return { content: [{ type: "text", text: JSON.stringify(findings, null, 2) }] };
  }
);

server.tool(
  "check-todos",
  "Find unresolved TODO, FIXME, HACK, and XXX comments",
  { projectDir: z.string().describe("Absolute path to the project root") },
  async ({ projectDir }) => {
    const findings = await checkTodoFixmes(projectDir);
    return { content: [{ type: "text", text: JSON.stringify(findings, null, 2) }] };
  }
);

// ─── Merger Tools ───────────────────────────────────────────────────────────

server.tool(
  "merge-domain-reports",
  "Merge multiple domain reports into a consolidated audit report with scoring and deduplication",
  {
    domainReportsJson: z.string().describe("JSON string — array of domain report objects"),
    target: z.string().describe("Repository or path being audited"),
    profile: z.string().describe("Policy profile used (e.g., java-angular-playwright)"),
  },
  async ({ domainReportsJson, target, profile }) => {
    const domainReports = z.array(DomainReportSchema).parse(JSON.parse(domainReportsJson));
    const policies = await loadAllPolicies(POLICIES_DIR, profile);
    const consolidated = mergeReports(domainReports, target, profile, policies);
    return { content: [{ type: "text", text: JSON.stringify(consolidated, null, 2) }] };
  }
);

server.tool(
  "score-findings",
  "Compute a domain score from a list of findings",
  { findingsJson: z.string().describe("JSON string — array of finding objects") },
  async ({ findingsJson }) => {
    const findings = z.array(FindingSchema).parse(JSON.parse(findingsJson));
    const score = scoreDomain(findings);
    return { content: [{ type: "text", text: JSON.stringify({ score }, null, 2) }] };
  }
);

// ─── Start Server ───────────────────────────────────────────────────────────

async function main(): Promise<void> {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error("Inspectra MCP server running on stdio");
}

main().catch((error) => {
  console.error("Failed to start Inspectra MCP server:", error);
  process.exit(1);
});
