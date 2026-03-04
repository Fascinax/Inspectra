import { readFile, access } from "node:fs/promises";
import { join, relative } from "node:path";
import type { Finding } from "../types.js";
import type { ProfileConfig } from "../policies/loader.js";
import { createIdSequence } from "../utils/id.js";

const MAX_DESCRIPTION_LENGTH = 500;

/**
 * Parses coverage reports (JSON summary or lcov) and flags metrics below profile thresholds.
 */
export async function parseCoverage(projectDir: string, profile?: ProfileConfig): Promise<Finding[]> {
  const findings: Finding[] = [];
  const nextId = createIdSequence("TST");

  const possiblePaths = [
    join(projectDir, "coverage", "coverage-summary.json"),
    join(projectDir, "coverage", "coverage-final.json"),
  ];

  for (const coveragePath of possiblePaths) {
    try {
      await access(coveragePath);
      const raw = await readFile(coveragePath, "utf-8");
      const parsed: unknown = JSON.parse(raw);
      if (typeof parsed !== "object" || parsed === null) break;
      const { total } = parsed as { total?: { lines?: { pct: number }; branches?: { pct: number }; functions?: { pct: number } } };

      if (total) {
        const { lines, branches, functions } = total;
        const thresholds = {
          lines: profile?.coverage?.lines?.target ?? 80,
          branches: profile?.coverage?.branches?.target ?? 70,
          functions: profile?.coverage?.functions?.target ?? 75,
        };

        if (lines?.pct !== undefined && lines.pct < thresholds.lines) {
          findings.push(buildCoverageFinding({ id: nextId(), metric: "lines", actual: lines.pct, threshold: thresholds.lines, coveragePath, projectDir }));
        }
        if (branches?.pct !== undefined && branches.pct < thresholds.branches) {
          findings.push(
            buildCoverageFinding({ id: nextId(), metric: "branches", actual: branches.pct, threshold: thresholds.branches, coveragePath, projectDir }),
          );
        }
        if (functions?.pct !== undefined && functions.pct < thresholds.functions) {
          findings.push(
            buildCoverageFinding({ id: nextId(), metric: "functions", actual: functions.pct, threshold: thresholds.functions, coveragePath, projectDir }),
          );
        }
      }

      break;
    } catch {
      /* file not found, try next */
    }
  }

  return findings;
}

/**
 * Parses JUnit XML test result files and reports test failures and errors.
 */
export async function parseTestResults(projectDir: string): Promise<Finding[]> {
  const findings: Finding[] = [];
  const nextId = createIdSequence("TST", 50);

  const junitPath = join(projectDir, "test-results", "junit.xml");
  try {
    await access(junitPath);
    const xml = await readFile(junitPath, "utf-8");

    const failureMatches = xml.matchAll(
      /<testcase\s[^>]*?\bname="([^"]*)"[^>]*>[\s\S]*?<failure[^>]*message="([^"]*)"[\s\S]*?<\/testcase>/g,
    );
    for (const match of failureMatches) {
      const testName = match[1] ?? "(unknown test)";
      const message = match[2] ?? "";
      findings.push({
        id: nextId(),
        severity: "high",
        title: `Failing test: ${testName}`,
        description: message.substring(0, MAX_DESCRIPTION_LENGTH),
        domain: "tests",
        rule: "no-failing-test",
        confidence: 1.0,
        evidence: [{ file: relative(projectDir, junitPath) }],
        recommendation: "Fix the failing test or update it if the expected behavior changed.",
        effort: "small",
        tags: ["test-failure"],
      });
    }
  } catch {
    /* no junit report */
  }

  return findings;
}

type BuildCoverageParams = {
  id: string;
  metric: string;
  actual: number;
  threshold: number;
  coveragePath: string;
  projectDir: string;
};

function buildCoverageFinding(params: BuildCoverageParams): Finding {
  const { id, metric, actual, threshold, coveragePath, projectDir } = params;
  return {
    id,
    severity: actual < threshold - 20 ? "high" : "medium",
    title: `${metric} coverage below threshold: ${actual.toFixed(1)}% < ${threshold}%`,
    description: `The ${metric} coverage is ${actual.toFixed(1)}%, which is below the configured threshold of ${threshold}%.`,
    domain: "tests",
    rule: `low-${metric}-coverage`,
    confidence: 1.0,
    evidence: [{ file: relative(projectDir, coveragePath) }],
    recommendation: `Add tests to increase ${metric} coverage above ${threshold}%.`,
    effort: "medium",
    tags: ["coverage"],
  };
}
