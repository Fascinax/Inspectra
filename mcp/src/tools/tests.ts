import { readFile, access } from "node:fs/promises";
import { join, relative, extname } from "node:path";
import type { Finding } from "../types.js";
import type { ProfileConfig } from "../policies/loader.js";
import { collectSourceFiles } from "../utils/files.js";
import { createIdSequence } from "../utils/id.js";

const MAX_DESCRIPTION_LENGTH = 500;

const SOURCE_EXTENSIONS = [".ts", ".js", ".java"];
const TEST_PATTERNS = [/\.(test|spec)\.(ts|js|java)$/, /Test\.java$/];

/**
 * Parses coverage reports (JSON summary or lcov) and flags metrics below profile thresholds.
 *
 * @param projectDir - Absolute path to the project root.
 * @param profile - Optional policy profile with coverage thresholds.
 * @returns Array of `Finding` objects for metrics below threshold.
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
 *
 * @param projectDir - Absolute path to the project root.
 * @returns Array of `Finding` objects for each failed or errored test case.
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

/**
 * Detects source files that have no corresponding test file based
 * on common naming conventions (`*.test.ts`, `*Test.java`, etc.).
 *
 * @param projectDir - Absolute path to the project root.
 * @returns Array of `Finding` objects for each untested source file.
 */
export async function detectMissingTests(projectDir: string): Promise<Finding[]> {
  const findings: Finding[] = [];
  const nextId = createIdSequence("TST", 100);

  const allFiles = await collectSourceFiles(projectDir);
  const sourceFiles = allFiles.filter(
    (f) => SOURCE_EXTENSIONS.includes(extname(f)) && !TEST_PATTERNS.some((p) => p.test(f)),
  );

  // Build test file set: extract filename stems (without test/spec suffix)
  const testStems = new Set<string>();
  for (const f of allFiles) {
    if (TEST_PATTERNS.some((p) => p.test(f))) {
      const fileName = f.split(/[/\\]/).pop() ?? "";
      const stem = fileName.replace(/\.(test|spec)\.(ts|js|java)$/, ".$2").replace(/Test\.java$/, ".java");
      testStems.add(stem);
    }
  }

  for (const src of sourceFiles) {
    const baseName = src.split(/[/\\]/).pop() ?? "";
    if (baseName === "index.ts" || baseName === "index.js" || baseName.startsWith("types")) continue;

    if (!testStems.has(baseName)) {
      findings.push({
        id: nextId(),
        severity: "medium",
        title: `No test file for ${relative(projectDir, src)}`,
        domain: "tests",
        rule: "missing-test-file",
        confidence: 0.7,
        evidence: [{ file: relative(projectDir, src) }],
        recommendation: "Create a corresponding test file.",
        effort: "medium",
        tags: ["missing-test"],
      });
    }
  }

  return findings;
}

/**
 * Parses Playwright JSON test reports and flags test failures.
 *
 * @param projectDir - Absolute path to the project root.
 * @returns Array of `Finding` objects for each failing Playwright test.
 */
export async function parsePlaywrightReport(projectDir: string): Promise<Finding[]> {
  const findings: Finding[] = [];
  const nextId = createIdSequence("TST", 150);

  const candidatePaths = [
    join(projectDir, "playwright-report", "results.json"),
    join(projectDir, "test-results", "results.json"),
    join(projectDir, "test-results.json"),
  ];

  let reportPath: string | null = null;
  let raw: string | null = null;

  for (const p of candidatePaths) {
    try {
      await access(p);
      raw = await readFile(p, "utf-8");
      reportPath = p;
      break;
    } catch {
      /* try next */
    }
  }

  if (!raw || !reportPath) return findings;

  try {
    const report = JSON.parse(raw) as PlaywrightReport;

    function collectTests(suites: PlaywrightSuite[], parentTitle = ""): void {
      for (const suite of suites) {
        const title = parentTitle ? `${parentTitle} > ${suite.title}` : suite.title;
        if (suite.suites) collectTests(suite.suites, title);
        for (const test of suite.tests ?? []) {
          const lastResult = test.results?.[test.results.length - 1];
          if (!lastResult) continue;
          if (lastResult.status === "failed" || lastResult.status === "timedOut") {
            findings.push({
              id: nextId(),
              severity: "high",
              title: `Playwright failure: ${test.title}`,
              description: lastResult.error?.message?.substring(0, MAX_DESCRIPTION_LENGTH) ?? `Test ${lastResult.status} in ${title}`,
              domain: "tests",
              rule: "playwright-test-failure",
              confidence: 1.0,
              evidence: [{ file: relative(projectDir, reportPath ?? ""), snippet: `Suite: ${title}` }],
              recommendation: "Fix the failing Playwright test or update expected behavior.",
              effort: "medium",
              tags: ["playwright", "test-failure"],
            });
          }
        }
      }
    }

    collectTests(report.suites ?? []);
  } catch {
    /* malformed report */
  }

  return findings;
}

type PlaywrightReport = {
  suites?: PlaywrightSuite[];
};

type PlaywrightSuite = {
  title: string;
  suites?: PlaywrightSuite[];
  tests?: PlaywrightTest[];
};

type PlaywrightTest = {
  title: string;
  retries?: number;
  results?: Array<{
    status: "passed" | "failed" | "timedOut" | "skipped";
    duration?: number;
    error?: { message?: string };
  }>;
};

async function detectJunitFlakyTests(projectDir: string, nextId: () => string): Promise<Finding[]> {
  const findings: Finding[] = [];
  const junitPath = join(projectDir, "test-results", "junit.xml");
  try {
    await access(junitPath);
    const xml = await readFile(junitPath, "utf-8");
    const reruns = xml.matchAll(
      /<testcase\s[^>]*?\bname="([^"]*)"[^>]*>[\s\S]*?<(?:rerunFailure|flakyFailure)[^/][\s\S]*?<\/testcase>/g,
    );
    for (const match of reruns) {
      const testName = match[1];
      findings.push({
        id: nextId(),
        severity: "medium",
        title: `Flaky test detected: ${testName}`,
        description: `The test '${testName}' passed on retry, indicating non-deterministic behavior (flakiness).`,
        domain: "tests",
        rule: "flaky-test",
        confidence: 0.9,
        evidence: [{ file: relative(projectDir, junitPath) }],
        recommendation: "Investigate sources of non-determinism: async timing, shared state, external dependencies.",
        effort: "medium",
        tags: ["flaky-test", "reliability"],
      });
    }
  } catch {
    /* no junit report */
  }
  return findings;
}

async function detectPlaywrightFlakyTests(projectDir: string, nextId: () => string): Promise<Finding[]> {
  const findings: Finding[] = [];
  const playwrightPaths = [
    join(projectDir, "playwright-report", "results.json"),
    join(projectDir, "test-results", "results.json"),
    join(projectDir, "test-results.json"),
  ];

  for (const p of playwrightPaths) {
    try {
      await access(p);
      const raw = await readFile(p, "utf-8");
      const report = JSON.parse(raw) as PlaywrightReport;

      function findFlaky(suites: PlaywrightSuite[], parentTitle = ""): void {
        for (const suite of suites) {
          const title = parentTitle ? `${parentTitle} > ${suite.title}` : suite.title;
          if (suite.suites) findFlaky(suite.suites, title);
          for (const test of suite.tests ?? []) {
            const results = test.results ?? [];
            const hasFailure = results.some((r) => r.status === "failed" || r.status === "timedOut");
            const hasFinalPass = results.length > 1 && results.at(-1)?.status === "passed";
            if (hasFailure && hasFinalPass) {
              findings.push({
                id: nextId(),
                severity: "medium",
                title: `Flaky Playwright test: ${test.title}`,
                description: `'${test.title}' failed on first attempt(s) but passed after retry (${results.length} attempts).`,
                domain: "tests",
                rule: "flaky-test",
                confidence: 0.85,
                evidence: [{ file: relative(projectDir, p), snippet: `Suite: ${title}` }],
                recommendation: "Isolate test dependencies, fix race conditions or timing issues.",
                effort: "medium",
                tags: ["flaky-test", "playwright", "reliability"],
              });
            }
          }
        }
      }

      findFlaky(report.suites ?? []);
      break;
    } catch {
      /* try next */
    }
  }

  return findings;
}

/**
 * Detects flaky tests by checking JUnit XML for rerun markers
 * or Playwright reports for tests with multiple attempts.
 *
 * @param projectDir - Absolute path to the project root.
 * @returns Array of `Finding` objects for each detected flaky test.
 */
export async function detectFlakyTests(projectDir: string): Promise<Finding[]> {
  const nextId = createIdSequence("TST", 200);
  const junitFindings = await detectJunitFlakyTests(projectDir, nextId);
  const playwrightFindings = await detectPlaywrightFlakyTests(projectDir, nextId);
  return [...junitFindings, ...playwrightFindings];
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
