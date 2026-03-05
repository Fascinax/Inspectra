import { readFile, access } from "node:fs/promises";
import { join, relative } from "node:path";
import type { Finding } from "../types.js";
import { createIdSequence } from "../utils/id.js";
import { walkSuites, loadPlaywrightReport, type PlaywrightTest } from "./tests-playwright-utils.js";

const MAX_DESCRIPTION_LENGTH = 500;

/**
 * Parses Playwright JSON test reports and flags test failures.
 */
export async function parsePlaywrightReport(projectDir: string): Promise<Finding[]> {
  const loaded = await loadPlaywrightReport(projectDir);
  if (!loaded) return [];

  const { relativePath, report } = loaded;
  const findings: Finding[] = [];
  const nextId = createIdSequence("TST", 150);

  walkSuites(report.suites ?? [], (test, suitePath) => {
    const lastResult = test.results?.[test.results.length - 1];
    if (!lastResult) return;
    if (lastResult.status === "failed" || lastResult.status === "timedOut") {
      findings.push({
        id: nextId(),
        severity: "high",
        title: `Playwright failure: ${test.title}`,
        description: lastResult.error?.message?.substring(0, MAX_DESCRIPTION_LENGTH) ?? `Test ${lastResult.status} in ${suitePath}`,
        domain: "tests",
        rule: "playwright-test-failure",
        confidence: 1.0,
        evidence: [{ file: relativePath, snippet: `Suite: ${suitePath}` }],
        recommendation: "Fix the failing Playwright test or update expected behavior.",
        effort: "medium",
        tags: ["playwright", "test-failure"],
        source: "tool",
      });
    }
  });

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
        source: "tool",
      });
    }
  } catch {
    /* no junit report */
  }
  return findings;
}

async function detectPlaywrightFlakyTests(projectDir: string, nextId: () => string): Promise<Finding[]> {
  const loaded = await loadPlaywrightReport(projectDir);
  if (!loaded) return [];

  const { relativePath, report } = loaded;
  const findings: Finding[] = [];

  walkSuites(report.suites ?? [], (test: PlaywrightTest, suitePath: string) => {
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
        evidence: [{ file: relativePath, snippet: `Suite: ${suitePath}` }],
        recommendation: "Isolate test dependencies, fix race conditions or timing issues.",
        effort: "medium",
        tags: ["flaky-test", "playwright", "reliability"],
        source: "tool",
      });
    }
  });

  return findings;
}
