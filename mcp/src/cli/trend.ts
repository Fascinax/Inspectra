#!/usr/bin/env node
/* eslint-disable no-console */

/**
 * Inspectra CLI — Score Trend Analyzer
 *
 * Usage:
 *   node mcp/dist/cli/trend.js <report1.json> [report2.json ...] [--output=trend.md]
 *
 * Reads multiple consolidated JSON audit reports, computes a score trend,
 * and outputs a Markdown summary.
 */

import { resolve } from "node:path";
import { readFile, writeFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { buildTrendEntry, analyzeTrend, renderTrendMarkdown } from "../renderer/trend.js";
import { ConsolidatedReportSchema, type ConsolidatedReport } from "../types.js";

export type TrendCliOptions = {
  reportPaths: string[];
  output: string | null;
};

export function parseTrendArgs(argv: string[]): TrendCliOptions {
  const args = argv.slice(2);

  if (args.length === 0 || args[0] === "--help" || args[0] === "-h") {
    printUsage();
    process.exit(0);
  }

  const reportPaths = args.filter((a) => !a.startsWith("--")).map((p) => resolve(p));
  const output = extractTrendFlag(args, "--output") ?? null;

  return { reportPaths, output };
}

export function extractTrendFlag(args: string[], flag: string): string | undefined {
  const arg = args.find((a) => a.startsWith(`${flag}=`));
  return arg === undefined ? undefined : arg.slice(arg.indexOf("=") + 1);
}

export async function loadConsolidatedReport(filePath: string): Promise<ConsolidatedReport> {
  const raw = await readFile(filePath, "utf-8");
  return ConsolidatedReportSchema.parse(JSON.parse(raw));
}

function printUsage(): void {
  console.log(`
Inspectra CLI — Score Trend Analyzer

Usage:
  node mcp/dist/cli/trend.js <report1.json> [report2.json ...] [options]

Options:
  --output=<path>     Write trend report to file (default: stdout)
  --help              Show this help

Examples:
  node mcp/dist/cli/trend.js audit-jan.json audit-feb.json audit-mar.json
  node mcp/dist/cli/trend.js reports/*.json --output=trend.md
`);
}

async function main(): Promise<void> {
  const opts = parseTrendArgs(process.argv);

  if (opts.reportPaths.length < 2) {
    console.error("Error: at least 2 report files are required to compute a trend.");
    process.exit(1);
  }

  for (const p of opts.reportPaths) {
    if (!existsSync(p)) {
      console.error(`Error: file not found: ${p}`);
      process.exit(1);
    }
  }

  console.error(`Loading ${opts.reportPaths.length} report(s)...`);
  const reports = await Promise.all(opts.reportPaths.map(loadConsolidatedReport));
  const entries = reports.map(buildTrendEntry);
  const trend = analyzeTrend(entries);
  const rendered = renderTrendMarkdown(trend);

  if (opts.output) {
    await writeFile(opts.output, rendered, "utf-8");
    console.error(`Trend report written to: ${opts.output}`);
  } else {
    console.log(rendered);
  }

  console.error(`\n  Direction: ${trend.direction}`);
  console.error(`  Average:   ${trend.averageScore}/100`);
  console.error(`  Change:    ${trend.scoreChange > 0 ? "+" : ""}${trend.scoreChange}\n`);
}

const isMain = fileURLToPath(import.meta.url) === resolve(process.argv[1] ?? "");
if (isMain) {
  main().catch((err) => {
    console.error("Trend failed:", err);
    process.exit(1);
  });
}
