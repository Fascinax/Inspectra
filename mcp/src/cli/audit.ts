#!/usr/bin/env node

/**
 * Inspectra CLI — Run a full audit locally without Copilot.
 *
 * Usage:
 *   npx inspectra audit <target-project-path> [--profile=generic] [--format=markdown|json] [--output=report.md]
 *
 * This calls every MCP tool programmatically, merges the results,
 * computes scores, and generates a consolidated report.
 */

import { resolve, join } from "node:path";
import { existsSync } from "node:fs";
import { writeFile } from "node:fs/promises";
import { globby } from "globby";

import { scanSecrets, checkDependencyVulnerabilities } from "../tools/security.js";
import { parseCoverage, parseTestResults, detectMissingTests } from "../tools/tests.js";
import { checkLayering, analyzeModuleDependencies } from "../tools/architecture.js";
import { checkNamingConventions, checkFileLengths, checkTodoFixmes } from "../tools/code-quality.js";
import { scoreDomain } from "../merger/score.js";
import { mergeReports } from "../merger/merge-findings.js";
import { renderMarkdown } from "../renderer/markdown.js";
import { renderJson } from "../renderer/json.js";
import type { DomainReport, Finding } from "../types.js";

interface CliOptions {
  target: string;
  profile: string;
  format: "markdown" | "json";
  output: string | null;
}

function parseArgs(argv: string[]): CliOptions {
  const args = argv.slice(2);

  if (args.length === 0 || args[0] === "--help" || args[0] === "-h") {
    printUsage();
    process.exit(0);
  }

  const target = resolve(args.find((a) => !a.startsWith("--")) ?? ".");
  const profile = extractFlag(args, "--profile") ?? "generic";
  const format = (extractFlag(args, "--format") ?? "markdown") as "markdown" | "json";
  const output = extractFlag(args, "--output") ?? null;

  return { target, profile, format, output };
}

function extractFlag(args: string[], flag: string): string | undefined {
  const arg = args.find((a) => a.startsWith(`${flag}=`));
  return arg?.split("=")[1];
}

function printUsage(): void {
  console.log(`
Inspectra CLI — Local Audit Runner

Usage:
  node mcp/dist/cli/audit.js <target-project-path> [options]

Options:
  --profile=<name>    Policy profile (default: generic)
  --format=<type>     Output format: markdown | json (default: markdown)
  --output=<path>     Write report to file (default: stdout)
  --help              Show this help

Examples:
  node mcp/dist/cli/audit.js ./my-project
  node mcp/dist/cli/audit.js ./my-project --profile=java-backend --format=json
  node mcp/dist/cli/audit.js ./my-project --output=audit-report.md
`);
}

async function collectSourceFiles(projectDir: string): Promise<string[]> {
  return globby(["**/*.ts", "**/*.js", "**/*.java"], {
    cwd: projectDir,
    absolute: true,
    ignore: ["**/node_modules/**", "**/dist/**", "**/.git/**", "**/coverage/**"],
  });
}

async function runSecurityAudit(projectDir: string, sourceFiles: string[]): Promise<DomainReport> {
  const start = Date.now();
  console.error("  [security] Scanning secrets...");
  const secretFindings = await scanSecrets(sourceFiles);

  console.error("  [security] Checking dependency vulnerabilities...");
  const vulnFindings = await checkDependencyVulnerabilities(projectDir);

  const findings = [...secretFindings, ...vulnFindings];
  const score = scoreDomain(findings);

  return buildDomainReport("security", "audit-security", findings, score, start, ["scan-secrets", "check-deps-vulns"]);
}

async function runTestsAudit(projectDir: string): Promise<DomainReport> {
  const start = Date.now();
  console.error("  [tests] Parsing coverage reports...");
  const coverageFindings = await parseCoverage(projectDir);

  console.error("  [tests] Parsing test results...");
  const testResultFindings = await parseTestResults(projectDir);

  console.error("  [tests] Detecting missing tests...");
  const missingTestFindings = await detectMissingTests(projectDir);

  const findings = [...coverageFindings, ...testResultFindings, ...missingTestFindings];
  const score = scoreDomain(findings);

  return buildDomainReport("tests", "audit-tests", findings, score, start, [
    "parse-coverage", "parse-test-results", "detect-missing-tests",
  ]);
}

async function runArchitectureAudit(projectDir: string): Promise<DomainReport> {
  const start = Date.now();
  console.error("  [architecture] Checking layer dependencies...");
  const layerFindings = await checkLayering(projectDir);

  console.error("  [architecture] Analyzing module dependencies...");
  const depFindings = await analyzeModuleDependencies(projectDir);

  const findings = [...layerFindings, ...depFindings];
  const score = scoreDomain(findings);

  return buildDomainReport("architecture", "audit-architecture", findings, score, start, [
    "check-layering", "analyze-dependencies",
  ]);
}

async function runConventionsAudit(projectDir: string): Promise<DomainReport> {
  const start = Date.now();
  console.error("  [conventions] Checking naming conventions...");
  const namingFindings = await checkNamingConventions(projectDir);

  console.error("  [conventions] Checking file lengths...");
  const lengthFindings = await checkFileLengths(projectDir);

  console.error("  [conventions] Checking TODO/FIXME comments...");
  const todoFindings = await checkTodoFixmes(projectDir);

  const findings = [...namingFindings, ...lengthFindings, ...todoFindings];
  const score = scoreDomain(findings);

  return buildDomainReport("conventions", "audit-conventions", findings, score, start, [
    "check-naming", "check-file-lengths", "check-todos",
  ]);
}

function buildDomainReport(
  domain: DomainReport["domain"],
  agent: string,
  findings: Finding[],
  score: number,
  startMs: number,
  tools: string[],
): DomainReport {
  const severityCounts = findings.reduce(
    (acc, f) => { acc[f.severity] = (acc[f.severity] ?? 0) + 1; return acc; },
    {} as Record<string, number>,
  );

  const summaryParts = Object.entries(severityCounts)
    .filter(([, c]) => c > 0)
    .map(([sev, c]) => `${c} ${sev}`);

  return {
    domain,
    score,
    summary: summaryParts.length > 0 ? summaryParts.join(", ") : "No issues found",
    findings,
    metadata: {
      agent,
      timestamp: new Date().toISOString(),
      duration_ms: Date.now() - startMs,
      tools_used: tools,
    },
  };
}

async function main(): Promise<void> {
  const opts = parseArgs(process.argv);

  if (!existsSync(opts.target)) {
    console.error(`Error: target path does not exist: ${opts.target}`);
    process.exit(1);
  }

  const totalStart = Date.now();

  console.error(`\n╔══════════════════════════════════════╗`);
  console.error(`║       INSPECTRA — Local Audit        ║`);
  console.error(`╚══════════════════════════════════════╝`);
  console.error(`  Target:  ${opts.target}`);
  console.error(`  Profile: ${opts.profile}`);
  console.error(`  Format:  ${opts.format}`);
  console.error(``);

  console.error("Collecting source files...");
  const sourceFiles = await collectSourceFiles(opts.target);
  console.error(`  Found ${sourceFiles.length} source files.\n`);

  console.error("Running audits...\n");

  const [securityReport, testsReport, archReport, convReport] = await Promise.all([
    runSecurityAudit(opts.target, sourceFiles),
    runTestsAudit(opts.target),
    runArchitectureAudit(opts.target),
    runConventionsAudit(opts.target),
  ]);

  console.error("\nMerging reports...");
  const consolidated = mergeReports(
    [securityReport, testsReport, archReport, convReport],
    opts.target,
    opts.profile,
  );

  consolidated.metadata.duration_ms = Date.now() - totalStart;

  const rendered = opts.format === "json"
    ? renderJson(consolidated)
    : renderMarkdown(consolidated);

  if (opts.output) {
    await writeFile(opts.output, rendered, "utf-8");
    console.error(`\nReport written to: ${opts.output}`);
  } else {
    console.log(rendered);
  }

  console.error(`\n  Score: ${consolidated.overall_score}/100 (Grade ${consolidated.grade})`);
  console.error(`  Findings: ${consolidated.statistics?.total_findings ?? 0}`);
  console.error(`  Duration: ${((Date.now() - totalStart) / 1000).toFixed(1)}s\n`);
}

main().catch((err) => {
  console.error("Audit failed:", err);
  process.exit(1);
});
