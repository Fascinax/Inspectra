#!/usr/bin/env node
/* eslint-disable no-console */

/**
 * Inspectra CLI — Report Comparison Tool
 *
 * Usage:
 *   node mcp/dist/cli/compare.js <baseline.json> <current.json> [--label-a=...] [--label-b=...] [--output=diff.md]
 *
 * Reads two consolidated JSON audit reports and outputs a side-by-side
 * Markdown comparison showing score deltas and finding diffs.
 */

import { resolve } from "node:path";
import { readFile, writeFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { compareReports, renderComparisonMarkdown } from "../renderer/compare.js";
import type { ConsolidatedReport } from "../types.js";

export type CompareCliOptions = {
  baselinePath: string;
  currentPath: string;
  labelA: string;
  labelB: string;
  output: string | null;
};

export function parseCompareArgs(argv: string[]): CompareCliOptions {
  const args = argv.slice(2);

  if (args.length === 0 || args[0] === "--help" || args[0] === "-h") {
    printUsage();
    process.exit(0);
  }

  const positional = args.filter((a) => !a.startsWith("--"));
  const baselinePath = resolve(positional[0] ?? ".");
  const currentPath = resolve(positional[1] ?? ".");
  const labelA = extractCompareFlag(args, "--label-a") ?? "Baseline";
  const labelB = extractCompareFlag(args, "--label-b") ?? "Current";
  const output = extractCompareFlag(args, "--output") ?? null;

  return { baselinePath, currentPath, labelA, labelB, output };
}

export function extractCompareFlag(args: string[], flag: string): string | undefined {
  const arg = args.find((a) => a.startsWith(`${flag}=`));
  return arg === undefined ? undefined : arg.slice(arg.indexOf("=") + 1);
}

export async function loadReportFromFile(filePath: string): Promise<ConsolidatedReport> {
  const raw = await readFile(filePath, "utf-8");
  return JSON.parse(raw) as ConsolidatedReport;
}

function printUsage(): void {
  console.log(`
Inspectra CLI — Report Comparison Tool

Usage:
  node mcp/dist/cli/compare.js <baseline.json> <current.json> [options]

Options:
  --label-a=<name>    Label for the baseline report (default: Baseline)
  --label-b=<name>    Label for the current report (default: Current)
  --output=<path>     Write comparison report to file (default: stdout)
  --help              Show this help

Examples:
  node mcp/dist/cli/compare.js main-audit.json pr-audit.json
  node mcp/dist/cli/compare.js main.json pr.json --label-a=main --label-b=feature/auth
  node mcp/dist/cli/compare.js baseline.json current.json --output=diff.md
`);
}

async function main(): Promise<void> {
  const opts = parseCompareArgs(process.argv);

  for (const p of [opts.baselinePath, opts.currentPath]) {
    if (!existsSync(p)) {
      console.error(`Error: file not found: ${p}`);
      process.exit(1);
    }
  }

  console.error(`Comparing reports...`);
  const [reportA, reportB] = await Promise.all([
    loadReportFromFile(opts.baselinePath),
    loadReportFromFile(opts.currentPath),
  ]);

  const result = compareReports(reportA, reportB, opts.labelA, opts.labelB);
  const rendered = renderComparisonMarkdown(result);

  if (opts.output) {
    await writeFile(opts.output, rendered, "utf-8");
    console.error(`Comparison report written to: ${opts.output}`);
  } else {
    console.log(rendered);
  }

  const sign = result.overallDelta > 0 ? "+" : "";
  console.error(`\n  ${opts.labelA}: ${result.reportA.score}/100 (${result.reportA.grade})`);
  console.error(`  ${opts.labelB}: ${result.reportB.score}/100 (${result.reportB.grade})`);
  console.error(`  Delta:    ${sign}${result.overallDelta}`);
  console.error(`  Added:    ${result.added.length} finding(s)`);
  console.error(`  Removed:  ${result.removed.length} finding(s)\n`);
}

const isMain = fileURLToPath(import.meta.url) === resolve(process.argv[1] ?? "");
if (isMain) {
  main().catch((err) => {
    console.error("Compare failed:", err);
    process.exit(1);
  });
}
