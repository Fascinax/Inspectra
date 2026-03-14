/**
 * Benchmark Runner — CLI scaffold for ADR-008 evaluation.
 *
 * Usage:
 *   npx tsx evaluations/benchmark-runner.ts --evaluate --audit-file runs/tier-a-express-run1.json
 *   npx tsx evaluations/benchmark-runner.ts --evaluate --audit-file evaluations/fixtures/bench-ts-express/.inspectra/consolidated-report.json --tier C
 *   npx tsx evaluations/benchmark-runner.ts --compare --results-dir evaluations/results/
 *
 * The runner accepts either a normalized benchmark audit file or an
 * Inspectra consolidated report and normalizes it before scoring.
 */

import { readFileSync, writeFileSync, mkdirSync, existsSync, readdirSync } from "node:fs";
import { resolve, join, basename, dirname } from "node:path";
import {
  loadGroundTruth,
  computeMetrics,
  aggregateRuns,
  generateComparisonTable,
  generateMissedReport,
} from "./benchmark-harness.js";
import type {
  AuditFinding,
  AuditOutput,
  MetricResults,
  AggregatedMetrics,
} from "./benchmark-harness.js";
import { BENCHMARK_CONFIG } from "./benchmark-config.js";

type BenchmarkTier = AuditOutput["tier"];

interface CliArgs {
  mode: "evaluate" | "compare" | "help";
  tier?: string;
  fixture?: string;
  auditFile?: string;
  outputDir: string;
  resultsDir?: string;
}

interface ConsolidatedDomainReport {
  findings?: AuditFinding[];
}

interface ConsolidatedAuditReport {
  metadata?: {
    target?: string;
    token_count?: number;
    latency_ms?: number;
  };
  domain_reports?: ConsolidatedDomainReport[];
}

interface ResolvedAuditInput {
  requestedPath: string;
  inputPath: string;
  usedFallback: boolean;
}

function parseArgs(argv: string[]): CliArgs {
  const args: CliArgs = { mode: "help", outputDir: "evaluations/results" };

  for (let index = 2; index < argv.length; index++) {
    switch (argv[index]) {
      case "--evaluate":
        args.mode = "evaluate";
        break;
      case "--compare":
        args.mode = "compare";
        break;
      case "--tier":
        args.tier = argv[++index];
        break;
      case "--fixture":
        args.fixture = argv[++index];
        break;
      case "--audit-file":
        args.auditFile = argv[++index];
        break;
      case "--output":
        args.outputDir = argv[++index];
        break;
      case "--results-dir":
        args.resultsDir = argv[++index];
        break;
      case "--help":
        args.mode = "help";
        break;
    }
  }

  return args;
}

function normalizeTier(rawTier?: string): BenchmarkTier | undefined {
  const normalizedTier = rawTier?.trim().toUpperCase();
  if (normalizedTier === "A" || normalizedTier === "B" || normalizedTier === "C") {
    return normalizedTier;
  }

  return undefined;
}

function inferTierFromPath(auditFilePath: string): BenchmarkTier | undefined {
  const fileName = basename(auditFilePath);
  const tierMatch = fileName.match(/(?:^|[-_])tier[-_]?([abc])(?:[-_.]|$)/i)
    ?? fileName.match(/^(A|B|C)(?:[-_.]|$)/i);

  return normalizeTier(tierMatch?.[1]);
}

function getFixtureTokens(fixtureName: string): string[] {
  return fixtureName
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter(token => token.length > 1 && !["bench", "ts", "java", "app"].includes(token));
}

function inferFixtureName(rawValue?: string): string | undefined {
  if (!rawValue) {
    return undefined;
  }

  const normalizedValue = rawValue.toLowerCase().replace(/\\/g, "/");
  const exactFixture = BENCHMARK_CONFIG.fixtures.find(fixture => normalizedValue.includes(fixture.name.toLowerCase()));
  if (exactFixture) {
    return exactFixture.name;
  }

  let bestFixture: string | undefined;
  let bestScore = 0;

  for (const fixture of BENCHMARK_CONFIG.fixtures) {
    const fixtureScore = getFixtureTokens(fixture.name)
      .filter(token => normalizedValue.includes(token)).length;

    if (fixtureScore > bestScore) {
      bestFixture = fixture.name;
      bestScore = fixtureScore;
    }
  }

  return bestScore > 0 ? bestFixture : undefined;
}

function resolveAuditInput(args: CliArgs): ResolvedAuditInput {
  if (!args.auditFile) {
    console.error("Error: --audit-file is required for --evaluate mode");
    process.exit(1);
  }

  const requestedPath = resolve(args.auditFile);
  if (existsSync(requestedPath)) {
    return { requestedPath, inputPath: requestedPath, usedFallback: false };
  }

  const inferredFixtureName = args.fixture ?? inferFixtureName(requestedPath);
  const fixtureConfig = BENCHMARK_CONFIG.fixtures.find(fixture => fixture.name === inferredFixtureName);
  if (!fixtureConfig) {
    console.error(`Error: Audit file does not exist: ${requestedPath}`);
    console.error("Tip: pass --fixture explicitly or use a file name that hints the fixture name.");
    process.exit(1);
  }

  const fallbackPath = resolve(fixtureConfig.path, ".inspectra", "consolidated-report.json");
  if (!existsSync(fallbackPath)) {
    console.error(`Error: Audit file does not exist: ${requestedPath}`);
    console.error(`Fallback report not found: ${fallbackPath}`);
    process.exit(1);
  }

  console.warn(`Warning: ${requestedPath} not found. Falling back to ${fallbackPath}.`);
  return { requestedPath, inputPath: fallbackPath, usedFallback: true };
}

function isAuditOutput(value: unknown): value is AuditOutput {
  if (typeof value !== "object" || value === null) {
    return false;
  }

  const candidate = value as Partial<AuditOutput>;
  return typeof candidate.tier === "string"
    && typeof candidate.fixture === "string"
    && Array.isArray(candidate.findings);
}

function isConsolidatedAuditReport(value: unknown): value is ConsolidatedAuditReport {
  if (typeof value !== "object" || value === null) {
    return false;
  }

  return Array.isArray((value as ConsolidatedAuditReport).domain_reports);
}

function normalizeAuditInput(rawInput: unknown, args: CliArgs, inputPath: string, requestedPath?: string): AuditOutput {
  if (isAuditOutput(rawInput)) {
    return rawInput;
  }

  if (!isConsolidatedAuditReport(rawInput)) {
    console.error("Error: Unsupported audit file shape. Expected AuditOutput or Inspectra consolidated report JSON.");
    process.exit(1);
  }

  const tier = normalizeTier(args.tier) ?? inferTierFromPath(requestedPath ?? inputPath) ?? inferTierFromPath(inputPath);
  if (!tier) {
    console.error("Error: Could not infer tier from the audit file. Pass --tier A|B|C explicitly.");
    process.exit(1);
  }

  const fixture = args.fixture
    ?? inferFixtureName(rawInput.metadata?.target)
    ?? inferFixtureName(requestedPath ?? inputPath) ?? inferFixtureName(inputPath);
  if (!fixture) {
    console.error("Error: Could not infer fixture from the audit file. Pass --fixture <name> explicitly.");
    process.exit(1);
  }

  const findings = (rawInput.domain_reports ?? []).flatMap(domainReport => domainReport.findings ?? []);

  return {
    tier,
    fixture,
    findings,
    token_count: rawInput.metadata?.token_count,
    latency_ms: rawInput.metadata?.latency_ms,
  };
}

function runEvaluate(args: CliArgs): void {
  const resolvedAuditInput = resolveAuditInput(args);
  const auditRaw = readFileSync(resolvedAuditInput.inputPath, "utf-8");
  const auditOutput = normalizeAuditInput(JSON.parse(auditRaw), args, resolvedAuditInput.inputPath, resolvedAuditInput.requestedPath);

  if (resolvedAuditInput.usedFallback) {
    mkdirSync(dirname(resolvedAuditInput.requestedPath), { recursive: true });
    writeFileSync(resolvedAuditInput.requestedPath, `${JSON.stringify(auditOutput, null, 2)}\n`);
    console.log(`Normalized audit snapshot written to ${resolvedAuditInput.requestedPath}`);
  }

  const fixtureConfig = BENCHMARK_CONFIG.fixtures.find(fixture => fixture.name === auditOutput.fixture);
  if (!fixtureConfig) {
    console.error(`Error: Unknown fixture "${auditOutput.fixture}". Known: ${BENCHMARK_CONFIG.fixtures.map(fixture => fixture.name).join(", ")}`);
    process.exit(1);
  }

  const groundTruth = loadGroundTruth(fixtureConfig.groundTruthPath);
  const metrics = computeMetrics(groundTruth, auditOutput);

  const outputDirectory = resolve(args.outputDir);
  mkdirSync(outputDirectory, { recursive: true });
  const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
  const metricsFilePath = join(outputDirectory, `${auditOutput.tier}-${auditOutput.fixture}-${timestamp}.json`);
  writeFileSync(metricsFilePath, JSON.stringify(metrics, null, 2));

  const missedReport = generateMissedReport(groundTruth, metrics);
  const missedReportPath = join(outputDirectory, `${auditOutput.tier}-${auditOutput.fixture}-${timestamp}-missed.md`);
  writeFileSync(missedReportPath, missedReport);

  console.log(`\n--- Evaluation: Tier ${metrics.tier} × ${metrics.fixture} ---\n`);
  console.log(`  Input:            ${resolvedAuditInput.inputPath}`);
  console.log(`  Precision:        ${metrics.precision}`);
  console.log(`  Recall:           ${metrics.recall}`);
  console.log(`  Tool Recall:      ${metrics.toolRecall}`);
  console.log(`  LLM-Only Recall:  ${metrics.llmOnlyRecall}`);
  console.log(`  RC Hit Rate:      ${metrics.rootCauseHitRate}`);
  console.log(`  Actionability:    ${metrics.actionabilityScore}`);
  console.log(`  Dedup:            ${metrics.dedupEffectiveness}`);
  console.log(`  Findings:         ${metrics.findingCount} (TP: ${metrics.truePositives}, FP: ${metrics.falsePositives}, Missed: ${metrics.missedIssues})`);
  if (metrics.diagnosticValue != null) {
    console.log(`  Diagnostic Value: ${metrics.diagnosticValue}`);
  }
  console.log(`\n  Results: ${metricsFilePath}`);
  console.log(`  Missed:  ${missedReportPath}\n`);
}

function runCompare(args: CliArgs): void {
  const resultsDirectory = resolve(args.resultsDir ?? args.outputDir);
  if (!existsSync(resultsDirectory)) {
    console.error(`Error: Results directory does not exist: ${resultsDirectory}`);
    process.exit(1);
  }

  const files = readdirSync(resultsDirectory).filter(file => file.endsWith(".json") && !file.includes("-missed"));
  if (files.length === 0) {
    console.error("Error: No result JSON files found in", resultsDirectory);
    process.exit(1);
  }

  const allResults: MetricResults[] = files.map(file => {
    const raw = readFileSync(join(resultsDirectory, file), "utf-8");
    return JSON.parse(raw) as MetricResults;
  });

  const groupedResults = new Map<string, MetricResults[]>();
  for (const result of allResults) {
    const groupKey = `${result.tier}:${result.fixture}`;
    if (!groupedResults.has(groupKey)) {
      groupedResults.set(groupKey, []);
    }
    groupedResults.get(groupKey)!.push(result);
  }

  const aggregatedResults: AggregatedMetrics[] = [];
  for (const [, runs] of groupedResults) {
    aggregatedResults.push(aggregateRuns(runs));
  }

  aggregatedResults.sort((left, right) => left.fixture.localeCompare(right.fixture) || left.tier.localeCompare(right.tier));

  const comparisonTable = generateComparisonTable(aggregatedResults);
  const report = [
    "# ADR-008 Benchmark Results\n",
    `Generated: ${new Date().toISOString()}\n`,
    `Total runs: ${allResults.length} across ${groupedResults.size} tier×fixture combinations\n`,
    comparisonTable,
    "",
    "## Decision Gates\n",
    `- Min Precision: ${BENCHMARK_CONFIG.thresholds.minPrecision}`,
    `- Min Recall: ${BENCHMARK_CONFIG.thresholds.minRecall}`,
    `- Max Variance (s): ${BENCHMARK_CONFIG.thresholds.maxVariance}`,
    `- Min Actionability: ${BENCHMARK_CONFIG.thresholds.minActionability}`,
    "",
    "## Interpretation\n",
    "If Tier A or B achieves comparable precision/recall to Tier C with lower token cost and variance,",
    "ADR-008 recommends adopting the simpler architecture. See `docs/adr/008-benchmark-before-architecture.md`.",
  ].join("\n");

  const outputDirectory = resolve(args.outputDir);
  mkdirSync(outputDirectory, { recursive: true });
  const reportFilePath = join(outputDirectory, "benchmark-comparison.md");
  writeFileSync(reportFilePath, report);

  console.log(comparisonTable);
  console.log(`\nFull report: ${reportFilePath}`);
}

function printHelp(): void {
  console.log(`
ADR-008 Benchmark Runner

Commands:
  --evaluate   Evaluate a single audit output against ground truth
  --compare    Aggregate results and produce comparison table

Options:
  --audit-file <path>    Path to audit output JSON (required for --evaluate)
  --tier <A|B|C>         Required when evaluating a consolidated report without a tier hint in its file name
  --fixture <name>       Optional fixture override when the file name is ambiguous
  --results-dir <path>   Directory containing result JSONs (for --compare)
  --output <dir>         Output directory (default: evaluations/results/)
  --help                 Show this help

Examples:
  # Evaluate a normalized run file
  npx tsx evaluations/benchmark-runner.ts --evaluate --audit-file runs/tier-a-express-run1.json

  # Evaluate directly from an Inspectra consolidated report
  npx tsx evaluations/benchmark-runner.ts --evaluate --audit-file evaluations/fixtures/bench-ts-express/.inspectra/consolidated-report.json --tier C

  # Compare all results
  npx tsx evaluations/benchmark-runner.ts --compare --results-dir evaluations/results/

Workflow:
  1. Run a tier prompt in Copilot (Tier A, B, or C) against a fixture repo
  2. Either save a normalized benchmark audit file or point the runner at .inspectra/consolidated-report.json
  3. Run --evaluate to compute metrics
  4. Repeat 3× per tier per fixture (as per ADR-008 protocol)
  5. Run --compare to generate the comparison table
`);
}

const args = parseArgs(process.argv);

switch (args.mode) {
  case "evaluate":
    runEvaluate(args);
    break;
  case "compare":
    runCompare(args);
    break;
  default:
    printHelp();
}



