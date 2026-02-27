import { readFile, access } from "node:fs/promises";
import { join, relative } from "node:path";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import type { Finding } from "../types.js";

const execFileAsync = promisify(execFile);

export async function parseCoverage(projectDir: string): Promise<Finding[]> {
  const findings: Finding[] = [];
  let counter = 1;

  const possiblePaths = [
    join(projectDir, "coverage", "coverage-summary.json"),
    join(projectDir, "coverage", "coverage-final.json"),
  ];

  for (const coveragePath of possiblePaths) {
    try {
      await access(coveragePath);
      const raw = await readFile(coveragePath, "utf-8");
      const data = JSON.parse(raw);

      if (data.total) {
        const { lines, branches, functions } = data.total;
        const thresholds = { lines: 80, branches: 70, functions: 75 };

        if (lines?.pct !== undefined && lines.pct < thresholds.lines) {
          findings.push(buildCoverageFinding(counter++, "lines", lines.pct, thresholds.lines, coveragePath, projectDir));
        }
        if (branches?.pct !== undefined && branches.pct < thresholds.branches) {
          findings.push(buildCoverageFinding(counter++, "branches", branches.pct, thresholds.branches, coveragePath, projectDir));
        }
        if (functions?.pct !== undefined && functions.pct < thresholds.functions) {
          findings.push(buildCoverageFinding(counter++, "functions", functions.pct, thresholds.functions, coveragePath, projectDir));
        }
      }

      break;
    } catch {
      /* file not found, try next */
    }
  }

  return findings;
}

export async function parseTestResults(projectDir: string): Promise<Finding[]> {
  const findings: Finding[] = [];
  let counter = 50;

  const junitPath = join(projectDir, "test-results", "junit.xml");
  try {
    await access(junitPath);
    const xml = await readFile(junitPath, "utf-8");

    const failureMatches = xml.matchAll(/<testcase\s[^>]*name="([^"]*)"[^>]*>[\s\S]*?<failure[^>]*message="([^"]*)"[\s\S]*?<\/testcase>/g);
    for (const match of failureMatches) {
      const testName = match[1];
      const message = match[2];
      findings.push({
        id: `TST-${String(counter++).padStart(3, "0")}`,
        severity: "high",
        title: `Failing test: ${testName}`,
        description: message.substring(0, 500),
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

export async function detectMissingTests(projectDir: string): Promise<Finding[]> {
  const findings: Finding[] = [];
  let counter = 100;

  try {
    const { stdout } = await execFileAsync("find", [projectDir, "-name", "*.ts", "-not", "-path", "*/node_modules/*", "-not", "-name", "*.test.ts", "-not", "-name", "*.spec.ts"], { timeout: 10_000 });
    const sourceFiles = stdout.trim().split("\n").filter(Boolean);

    const { stdout: testStdout } = await execFileAsync("find", [projectDir, "-name", "*.test.ts", "-o", "-name", "*.spec.ts"], { timeout: 10_000 });
    const testFiles = new Set(testStdout.trim().split("\n").filter(Boolean).map(f => f.replace(/\.(test|spec)\.ts$/, ".ts")));

    for (const src of sourceFiles) {
      const baseName = src.replace(/\.ts$/, "");
      const hasTest = testFiles.has(src) || testFiles.has(baseName + ".ts");
      if (!hasTest && !src.includes("/types") && !src.includes("/index.ts")) {
        findings.push({
          id: `TST-${String(counter++).padStart(3, "0")}`,
          severity: "medium",
          title: `No test file for ${relative(projectDir, src)}`,
          domain: "tests",
          rule: "missing-test-file",
          confidence: 0.7,
          evidence: [{ file: relative(projectDir, src) }],
          recommendation: "Create a corresponding .test.ts or .spec.ts file.",
          effort: "medium",
          tags: ["missing-test"],
        });
      }
    }
  } catch {
    /* find not available on this OS */
  }

  return findings;
}

function buildCoverageFinding(counter: number, metric: string, actual: number, threshold: number, coveragePath: string, projectDir: string): Finding {
  return {
    id: `TST-${String(counter).padStart(3, "0")}`,
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
