import { readFile, access } from "node:fs/promises";
import { join, relative } from "node:path";

export type PlaywrightReport = {
  suites?: PlaywrightSuite[];
};

export type PlaywrightSuite = {
  title: string;
  suites?: PlaywrightSuite[];
  tests?: PlaywrightTest[];
};

export type PlaywrightTest = {
  title: string;
  retries?: number;
  results?: Array<{
    status: "passed" | "failed" | "timedOut" | "skipped";
    duration?: number;
    error?: { message?: string };
  }>;
};

export type SuiteVisitor = (test: PlaywrightTest, suitePath: string) => void;

const REPORT_CANDIDATE_PATHS = [
  "playwright-report/results.json",
  "test-results/results.json",
  "test-results.json",
];

/**
 * Recursively walks Playwright suites and invokes the visitor for each test.
 * This is the single traversal point — callers provide their own visitor logic.
 */
export function walkSuites(suites: PlaywrightSuite[], visitor: SuiteVisitor, parentTitle = ""): void {
  for (const suite of suites) {
    const title = parentTitle ? `${parentTitle} > ${suite.title}` : suite.title;
    if (suite.suites) walkSuites(suite.suites, visitor, title);
    for (const test of suite.tests ?? []) {
      visitor(test, title);
    }
  }
}

/**
 * Finds and loads the first available Playwright JSON report from standard locations.
 * Returns null if no report is found.
 */
export async function loadPlaywrightReport(
  projectDir: string,
): Promise<{ path: string; relativePath: string; report: PlaywrightReport } | null> {
  for (const candidate of REPORT_CANDIDATE_PATHS) {
    const fullPath = join(projectDir, candidate);
    try {
      await access(fullPath);
      const raw = await readFile(fullPath, "utf-8");
      return {
        path: fullPath,
        relativePath: relative(projectDir, fullPath),
        report: JSON.parse(raw) as PlaywrightReport,
      };
    } catch {
      /* try next */
    }
  }
  return null;
}
