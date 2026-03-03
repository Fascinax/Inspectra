#!/usr/bin/env node
/* eslint-disable no-console */

/**
 * Inspectra CLI — Run a full audit locally without Copilot.
 *
 * Usage:
 *   npx inspectra audit <target-project-path> [--profile=generic] [--format=markdown|json] [--output=report.md]
 *
 * This calls every MCP tool programmatically, merges the results,
 * computes scores, and generates a consolidated report.
 */

import { resolve, join, dirname } from "node:path";
import { existsSync } from "node:fs";
import { writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { globby } from "globby";

import { scanSecrets, checkDependencyVulnerabilities, runSemgrep, checkMavenDependencies } from "../tools/security.js";
import {
  parseCoverage,
  parseTestResults,
  detectMissingTests,
  parsePlaywrightReport,
  detectFlakyTests,
} from "../tools/tests.js";
import { checkLayering, analyzeModuleDependencies, detectCircularDependencies } from "../tools/architecture.js";
import {
  checkNamingConventions,
  checkFileLengths,
  checkTodoFixmes,
  parseLintOutput,
  detectDryViolations,
} from "../tools/conventions.js";
import { analyzeBundleSize, checkBuildTimings, detectRuntimeMetrics } from "../tools/performance.js";
import { checkReadmeCompleteness, checkAdrPresence, detectDocCodeDrift } from "../tools/documentation.js";
import { analyzeComplexity, ageTodos, checkDependencyStaleness } from "../tools/tech-debt.js";
import { scoreDomain } from "../merger/score.js";
import { mergeReports } from "../merger/merge-findings.js";
import { renderMarkdown } from "../renderer/markdown.js";
import { renderJson } from "../renderer/json.js";
import { renderSarif } from "../renderer/sarif.js";
import { loadAllPolicies, type ProfileConfig, type ScoringConfig } from "../policies/loader.js";
import type { DomainReport, Finding } from "../types.js";

type CliOptions = {
  target: string;
  profile: string;
  format: "markdown" | "json" | "sarif";
  output: string | null;
};

function parseArgs(argv: string[]): CliOptions {
  const args = argv.slice(2);

  if (args.length === 0 || args[0] === "--help" || args[0] === "-h") {
    printUsage();
    process.exit(0);
  }

  const target = resolve(args.find((a) => !a.startsWith("--")) ?? ".");
  const profile = extractFlag(args, "--profile") ?? "generic";
  const format = (extractFlag(args, "--format") ?? "markdown") as "markdown" | "json" | "sarif";
  const output = extractFlag(args, "--output") ?? null;

  return { target, profile, format, output };
}

export function extractFlag(args: string[], flag: string): string | undefined {
  const arg = args.find((a) => a.startsWith(`${flag}=`));
  return arg === undefined ? undefined : arg.slice(arg.indexOf("=") + 1);
}

function printUsage(): void {
  console.log(`
Inspectra CLI — Local Audit Runner

Usage:
  node mcp/dist/cli/audit.js <target-project-path> [options]

Options:
  --profile=<name>    Policy profile (default: generic)
  --format=<type>     Output format: markdown | json | sarif (default: markdown)
  --output=<path>     Write report to file (default: stdout)
  --help              Show this help

Examples:
  node mcp/dist/cli/audit.js ./my-project
  node mcp/dist/cli/audit.js ./my-project --profile=java-backend --format=json
  node mcp/dist/cli/audit.js ./my-project --output=audit-report.md
`);
}

async function globSourceFiles(projectDir: string): Promise<string[]> {
  return globby(["**/*.ts", "**/*.js", "**/*.java"], {
    cwd: projectDir,
    absolute: true,
    ignore: ["**/node_modules/**", "**/dist/**", "**/.git/**", "**/coverage/**"],
  });
}

function resolvePoliciesDir(): string {
  const currentFile = fileURLToPath(import.meta.url);
  // cli/audit.js → mcp/dist/cli/audit.js → ../../.. → project root
  return join(dirname(currentFile), "..", "..", "..", "policies");
}

async function runSecurityAudit(
  projectDir: string,
  sourceFiles: string[],
  config?: ScoringConfig,
  profile?: ProfileConfig,
): Promise<DomainReport> {
  const start = Date.now();
  console.error("  [security] Scanning secrets...");
  const secretFindings = await scanSecrets(sourceFiles, profile?.security?.additional_patterns);

  console.error("  [security] Checking dependency vulnerabilities...");
  const vulnFindings = await checkDependencyVulnerabilities(projectDir);

  console.error("  [security] Running Semgrep analysis...");
  const semgrepFindings = await runSemgrep(projectDir);

  console.error("  [security] Checking Maven dependencies...");
  const mavenFindings = await checkMavenDependencies(projectDir);

  const findings = [...secretFindings, ...vulnFindings, ...semgrepFindings, ...mavenFindings];
  const score = scoreDomain(findings, config);

  return buildDomainReport({
    domain: "security",
    agent: "audit-security",
    findings,
    score,
    startMs: start,
    tools: ["inspectra_scan_secrets", "inspectra_check_deps_vulns", "inspectra_run_semgrep", "inspectra_check_maven_deps"],
  });
}

async function runTestsAudit(
  projectDir: string,
  profile?: ProfileConfig,
  config?: ScoringConfig,
): Promise<DomainReport> {
  const start = Date.now();
  console.error("  [tests] Parsing coverage reports...");
  const coverageFindings = await parseCoverage(projectDir, profile);

  console.error("  [tests] Parsing test results...");
  const testResultFindings = await parseTestResults(projectDir);

  console.error("  [tests] Detecting missing tests...");
  const missingTestFindings = await detectMissingTests(projectDir);

  console.error("  [tests] Parsing Playwright report...");
  const playwrightFindings = await parsePlaywrightReport(projectDir);

  console.error("  [tests] Detecting flaky tests...");
  const flakyFindings = await detectFlakyTests(projectDir);

  const findings = [
    ...coverageFindings,
    ...testResultFindings,
    ...missingTestFindings,
    ...playwrightFindings,
    ...flakyFindings,
  ];
  const score = scoreDomain(findings, config);

  return buildDomainReport({
    domain: "tests",
    agent: "audit-tests",
    findings,
    score,
    startMs: start,
    tools: ["inspectra_parse_coverage", "inspectra_parse_test_results", "inspectra_detect_missing_tests", "inspectra_parse_playwright_report", "inspectra_detect_flaky_tests"],
  });
}

async function runArchitectureAudit(
  projectDir: string,
  config?: ScoringConfig,
  profile?: ProfileConfig,
): Promise<DomainReport> {
  const start = Date.now();
  console.error("  [architecture] Checking layer dependencies...");
  const layerFindings = await checkLayering(projectDir, profile?.architecture?.allowed_dependencies);

  console.error("  [architecture] Analyzing module dependencies...");
  const depFindings = await analyzeModuleDependencies(projectDir);

  console.error("  [architecture] Detecting circular dependencies...");
  const circularFindings = await detectCircularDependencies(projectDir);

  const findings = [...layerFindings, ...depFindings, ...circularFindings];
  const score = scoreDomain(findings, config);

  return buildDomainReport({
    domain: "architecture",
    agent: "audit-architecture",
    findings,
    score,
    startMs: start,
    tools: ["inspectra_check_layering", "inspectra_analyze_dependencies", "inspectra_detect_circular_deps"],
  });
}

async function runConventionsAudit(
  projectDir: string,
  profile?: ProfileConfig,
  config?: ScoringConfig,
): Promise<DomainReport> {
  const start = Date.now();
  console.error("  [conventions] Checking naming conventions...");
  const namingFindings = await checkNamingConventions(projectDir);

  console.error("  [conventions] Checking file lengths...");
  const lengthFindings = await checkFileLengths(projectDir, profile);

  console.error("  [conventions] Checking TODO/FIXME comments...");
  const todoFindings = await checkTodoFixmes(projectDir);

  console.error("  [conventions] Parsing lint output...");
  const lintFindings = await parseLintOutput(projectDir);

  console.error("  [conventions] Detecting DRY violations...");
  const dryFindings = await detectDryViolations(projectDir);

  const findings = [...namingFindings, ...lengthFindings, ...todoFindings, ...lintFindings, ...dryFindings];
  const score = scoreDomain(findings, config);

  return buildDomainReport({
    domain: "conventions",
    agent: "audit-conventions",
    findings,
    score,
    startMs: start,
    tools: ["inspectra_check_naming", "inspectra_check_file_lengths", "inspectra_check_todos", "inspectra_parse_lint_output", "inspectra_detect_dry_violations"],
  });
}

async function runPerformanceAudit(projectDir: string, config?: ScoringConfig): Promise<DomainReport> {
  const start = Date.now();
  console.error("  [performance] Analyzing bundle sizes...");
  const bundleFindings = await analyzeBundleSize(projectDir);

  console.error("  [performance] Parsing build timings...");
  const buildFindings = await checkBuildTimings(projectDir);

  console.error("  [performance] Detecting runtime hotspots...");
  const runtimeFindings = await detectRuntimeMetrics(projectDir);

  const findings = [...bundleFindings, ...buildFindings, ...runtimeFindings];
  const score = scoreDomain(findings, config);

  return buildDomainReport({
    domain: "performance",
    agent: "audit-performance",
    findings,
    score,
    startMs: start,
    tools: ["inspectra_analyze_bundle_size", "inspectra_check_build_timings", "inspectra_detect_runtime_metrics"],
  });
}

async function runDocumentationAudit(projectDir: string, config?: ScoringConfig): Promise<DomainReport> {
  const start = Date.now();
  console.error("  [documentation] Checking README completeness...");
  const readmeFindings = await checkReadmeCompleteness(projectDir);

  console.error("  [documentation] Checking ADR presence...");
  const adrFindings = await checkAdrPresence(projectDir);

  console.error("  [documentation] Detecting doc-code drift...");
  const driftFindings = await detectDocCodeDrift(projectDir);

  const findings = [...readmeFindings, ...adrFindings, ...driftFindings];
  const score = scoreDomain(findings, config);

  return buildDomainReport({
    domain: "documentation",
    agent: "audit-documentation",
    findings,
    score,
    startMs: start,
    tools: ["inspectra_check_readme_completeness", "inspectra_check_adr_presence", "inspectra_detect_doc_code_drift"],
  });
}

async function runTechDebtAudit(projectDir: string, config?: ScoringConfig): Promise<DomainReport> {
  const start = Date.now();
  console.error("  [tech-debt] Analyzing complexity...");
  const complexityFindings = await analyzeComplexity(projectDir);

  console.error("  [tech-debt] Aging TODO/FIXME markers...");
  const agedTodoFindings = await ageTodos(projectDir);

  console.error("  [tech-debt] Checking dependency staleness...");
  const stalenessFindings = await checkDependencyStaleness(projectDir);

  const findings = [...complexityFindings, ...agedTodoFindings, ...stalenessFindings];
  const score = scoreDomain(findings, config);

  return buildDomainReport({
    domain: "tech-debt",
    agent: "audit-tech-debt",
    findings,
    score,
    startMs: start,
    tools: ["inspectra_analyze_complexity", "inspectra_age_todos", "inspectra_check_dependency_staleness"],
  });
}

type BuildDomainReportParams = {
  domain: DomainReport["domain"];
  agent: string;
  findings: Finding[];
  score: number;
  startMs: number;
  tools: string[];
};

export function buildDomainReport(params: BuildDomainReportParams): DomainReport {
  const { domain, agent, findings, score, startMs, tools } = params;
  const severityCounts = findings.reduce(
    (acc, f) => {
      acc[f.severity] = (acc[f.severity] ?? 0) + 1;
      return acc;
    },
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
  const sourceFiles = await globSourceFiles(opts.target);
  console.error(`  Found ${sourceFiles.length} source files.\n`);

  console.error("Loading policies...");
  const policiesDir = resolvePoliciesDir();
  const policies = await loadAllPolicies(policiesDir, opts.profile);
  console.error(`  Loaded profile: ${policies.profile?.profile ?? opts.profile}\n`);

  console.error("Running audits...\n");

  const [securityReport, testsReport, archReport, convReport, perfReport, docsReport, debtReport] = await Promise.all([
    runSecurityAudit(opts.target, sourceFiles, policies.scoring, policies.profile),
    runTestsAudit(opts.target, policies.profile, policies.scoring),
    runArchitectureAudit(opts.target, policies.scoring, policies.profile),
    runConventionsAudit(opts.target, policies.profile, policies.scoring),
    runPerformanceAudit(opts.target, policies.scoring),
    runDocumentationAudit(opts.target, policies.scoring),
    runTechDebtAudit(opts.target, policies.scoring),
  ]);

  console.error("\nMerging reports...");
  const consolidated = mergeReports(
    [securityReport, testsReport, archReport, convReport, perfReport, docsReport, debtReport],
    opts.target,
    opts.profile,
    policies,
  );

  consolidated.metadata.duration_ms = Date.now() - totalStart;

  const rendered =
    opts.format === "json"
      ? renderJson(consolidated)
      : opts.format === "sarif"
        ? renderSarif(consolidated)
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

// Only run when invoked directly (not when imported by tests or other modules)
const isMain = fileURLToPath(import.meta.url) === resolve(process.argv[1] ?? "");
if (isMain) {
  main().catch((err) => {
    console.error("Audit failed:", err);
    process.exit(1);
  });
}
