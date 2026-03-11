/**
 * Benchmark Runner — CLI scaffold for ADR-008 evaluation.
 *
 * Usage:
 *   npx tsx evaluations/benchmark-runner.ts --tier A --fixture bench-ts-express --output results/
 *   npx tsx evaluations/benchmark-runner.ts --all --output results/
 *
 * For now this is a scaffold: it loads ground truth, accepts a manually-produced
 * audit JSON, computes metrics, and writes the comparison report.
 * Actual tier runs require Copilot agents and will be triggered manually.
 */

import { readFileSync, writeFileSync, mkdirSync, existsSync, readdirSync } from "node:fs";
import { resolve, join, basename } from "node:path";
import {
  loadGroundTruth,
  computeMetrics,
  aggregateRuns,
  generateComparisonTable,
  generateMissedReport,
} from "./benchmark-harness.js";
import type { AuditOutput, MetricResults, AggregatedMetrics } from "./benchmark-harness.js";
import { BENCHMARK_CONFIG } from "./benchmark-config.js";

// ─── CLI Parsing ────────────────────────────────────────────────────────────

interface CliArgs {
  mode: "evaluate" | "compare" | "help";
  tier?: string;
  fixture?: string;
  auditFile?: string;
  outputDir: string;
  resultsDir?: string;
}

function parseArgs(argv: string[]): CliArgs {
  const args: CliArgs = { mode: "help", outputDir: "evaluations/results" };

  for (let i = 2; i < argv.length; i++) {
    switch (argv[i]) {
      case "--evaluate":
        args.mode = "evaluate";
        break;
      case "--compare":
        args.mode = "compare";
        break;
      case "--tier":
        args.tier = argv[++i];
        break;
      case "--fixture":
        args.fixture = argv[++i];
        break;
      case "--audit-file":
        args.auditFile = argv[++i];
        break;
      case "--output":
        args.outputDir = argv[++i];
        break;
      case "--results-dir":
        args.resultsDir = argv[++i];
        break;
      case "--help":
        args.mode = "help";
        break;
    }
  }

  return args;
}

// ─── Evaluate Mode ──────────────────────────────────────────────────────────

/**
 * Evaluate a single audit output against its ground truth.
 *
 * Expected workflow:
 * 1. Run a tier prompt manually in Copilot (Tier A, B, or C)
 * 2. Copy the JSON findings output into a file
 * 3. Run: npx tsx evaluations/benchmark-runner.ts --evaluate --audit-file path/to/output.json
 *
 * The audit file must conform to AuditOutput shape:
 * {
 *   "tier": "A",
 *   "fixture": "bench-ts-express",
 *   "findings": [...],
 *   "root_causes_reported": [...],  // optional
 *   "token_count": 12000,           // optional
 *   "latency_ms": 45000             // optional
 * }
 */
function runEvaluate(args: CliArgs): void {
  if (!args.auditFile) {
    console.error("Error: --audit-file is required for --evaluate mode");
    process.exit(1);
  }

  const auditRaw = readFileSync(resolve(args.auditFile), "utf-8");
  const auditOutput: AuditOutput = JSON.parse(auditRaw);

  const fixtureConfig = BENCHMARK_CONFIG.fixtures.find(f => f.name === auditOutput.fixture);
  if (!fixtureConfig) {
    console.error(`Error: Unknown fixture "${auditOutput.fixture}". Known: ${BENCHMARK_CONFIG.fixtures.map(f => f.name).join(", ")}`);
    process.exit(1);
  }

  const groundTruth = loadGroundTruth(fixtureConfig.groundTruthPath);
  const metrics = computeMetrics(groundTruth, auditOutput);

  // Write metrics JSON
  const outDir = resolve(args.outputDir);
  mkdirSync(outDir, { recursive: true });
  const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
  const outFile = join(outDir, `${auditOutput.tier}-${auditOutput.fixture}-${timestamp}.json`);
  writeFileSync(outFile, JSON.stringify(metrics, null, 2));

  // Write missed report
  const missedReport = generateMissedReport(groundTruth, metrics);
  const missedFile = join(outDir, `${auditOutput.tier}-${auditOutput.fixture}-${timestamp}-missed.md`);
  writeFileSync(missedFile, missedReport);

  // Summary to stdout
  console.log(`\n═══ Evaluation: Tier ${metrics.tier} × ${metrics.fixture} ═══\n`);
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
  console.log(`\n  Results: ${outFile}`);
  console.log(`  Missed:  ${missedFile}\n`);
}

// ─── Compare Mode ───────────────────────────────────────────────────────────

/**
 * Aggregate all result JSON files from a directory and produce a comparison table.
 *
 * npx tsx evaluations/benchmark-runner.ts --compare --results-dir evaluations/results/ --output evaluations/
 */
function runCompare(args: CliArgs): void {
  const resultsDir = resolve(args.resultsDir ?? args.outputDir);
  if (!existsSync(resultsDir)) {
    console.error(`Error: Results directory does not exist: ${resultsDir}`);
    process.exit(1);
  }

  const files = readdirSync(resultsDir).filter(f => f.endsWith(".json") && !f.includes("-missed"));
  if (files.length === 0) {
    console.error("Error: No result JSON files found in", resultsDir);
    process.exit(1);
  }

  // Load all results and group by tier + fixture
  const allResults: MetricResults[] = files.map(f => {
    const raw = readFileSync(join(resultsDir, f), "utf-8");
    return JSON.parse(raw) as MetricResults;
  });

  const groups = new Map<string, MetricResults[]>();
  for (const r of allResults) {
    const key = `${r.tier}:${r.fixture}`;
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key)!.push(r);
  }

  const aggregated: AggregatedMetrics[] = [];
  for (const [, runs] of groups) {
    aggregated.push(aggregateRuns(runs));
  }

  // Sort: by fixture, then tier
  aggregated.sort((a, b) => a.fixture.localeCompare(b.fixture) || a.tier.localeCompare(b.tier));

  const table = generateComparisonTable(aggregated);
  const report = [
    "# ADR-008 Benchmark Results\n",
    `Generated: ${new Date().toISOString()}\n`,
    `Total runs: ${allResults.length} across ${groups.size} tier×fixture combinations\n`,
    table,
    "",
    "## Decision Gates\n",
    `- Min Precision: ${BENCHMARK_CONFIG.thresholds.minPrecision}`,
    `- Min Recall: ${BENCHMARK_CONFIG.thresholds.minRecall}`,
    `- Max Variance (σ): ${BENCHMARK_CONFIG.thresholds.maxVariance}`,
    `- Min Actionability: ${BENCHMARK_CONFIG.thresholds.minActionability}`,
    "",
    "## Interpretation\n",
    "If Tier A or B achieves comparable precision/recall to Tier C with lower token cost and variance,",
    "ADR-008 recommends adopting the simpler architecture. See `docs/adr/008-benchmark-before-architecture.md`.",
  ].join("\n");

  const outDir = resolve(args.outputDir);
  mkdirSync(outDir, { recursive: true });
  const reportFile = join(outDir, "benchmark-comparison.md");
  writeFileSync(reportFile, report);

  console.log(table);
  console.log(`\nFull report: ${reportFile}`);
}

// ─── Help ───────────────────────────────────────────────────────────────────

function printHelp(): void {
  console.log(`
ADR-008 Benchmark Runner

Commands:
  --evaluate   Evaluate a single audit output against ground truth
  --compare    Aggregate results and produce comparison table

Options:
  --audit-file <path>    Path to audit output JSON (required for --evaluate)
  --results-dir <path>   Directory containing result JSONs (for --compare)
  --output <dir>         Output directory (default: evaluations/results/)
  --help                 Show this help

Examples:
  # Evaluate a Tier A run on bench-ts-express
  npx tsx evaluations/benchmark-runner.ts --evaluate --audit-file runs/tier-a-express.json

  # Compare all results
  npx tsx evaluations/benchmark-runner.ts --compare --results-dir evaluations/results/

Workflow:
  1. Run a tier prompt in Copilot (Tier A, B, or C) against a fixture repo
  2. Save the JSON findings output to a file with this shape:
     { "tier": "A", "fixture": "bench-ts-express", "findings": [...] }
  3. Run --evaluate to compute metrics
  4. Repeat 3× per tier per fixture (as per ADR-008 protocol)
  5. Run --compare to generate the comparison table
`);
}

// ─── Main ───────────────────────────────────────────────────────────────────

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
