import { readFile, access } from "node:fs/promises";
import { join, relative } from "node:path";
import type { Finding } from "../types.js";
import { createIdSequence } from "../utils/id.js";

const MAX_DESCRIPTION_LENGTH = 500;

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

/**
 * Parses Playwright JSON test reports and flags test failures.
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

/**
 * Detects flaky tests by checking JUnit XML for rerun markers
 * or Playwright reports for tests with multiple attempts.
 */
export async function detectFlakyTests(projectDir: string): Promise<Finding[]> {
  const nextId = createIdSequence("TST", 200);
  const junitFindings = await detectJunitFlakyTests(projectDir, nextId);
  const playwrightFindings = await detectPlaywrightFlakyTests(projectDir, nextId);
  return [...junitFindings, ...playwrightFindings];
}

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
