import { readFile, readdir, access } from "node:fs/promises";
import { join, relative, extname } from "node:path";
import type { Finding } from "../types.js";
import type { ProfileConfig } from "../policies/loader.js";

const SOURCE_EXTENSIONS = [".ts", ".js", ".java"];
const TEST_PATTERNS = [/\.(test|spec)\.(ts|js|java)$/, /Test\.java$/];

export async function parseCoverage(projectDir: string, profile?: ProfileConfig): Promise<Finding[]> {
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
        const thresholds = {
          lines: profile?.coverage?.lines?.target ?? 80,
          branches: profile?.coverage?.branches?.target ?? 70,
          functions: profile?.coverage?.functions?.target ?? 75,
        };

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

    const failureMatches = xml.matchAll(/<testcase\s[^>]*?\bname="([^"]*)"[^>]*>[\s\S]*?<failure[^>]*message="([^"]*)"[\s\S]*?<\/testcase>/g);
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

  const allFiles = await collectSourceFiles(projectDir);
  const sourceFiles = allFiles.filter((f) =>
    SOURCE_EXTENSIONS.includes(extname(f)) && !TEST_PATTERNS.some((p) => p.test(f)),
  );
  const testFiles = new Set(
    allFiles.filter((f) => TEST_PATTERNS.some((p) => p.test(f)))
      .map((f) => f.replace(/\.(test|spec)\.(ts|js|java)$/, ".$1").replace(/Test\.java$/, ".java"))
      .map((f) => {
        // Normalize: remove test/spec suffix to get base name
        return f.replace(/\.(test|spec)\.(ts|js|java)$/, ".$2");
      }),
  );

  // Rebuild test file set properly: strip test pattern to get the source equivalent
  const testBaseNames = new Set<string>();
  for (const f of allFiles) {
    if (TEST_PATTERNS.some((p) => p.test(f))) {
      const baseName = f
        .replace(/\.(test|spec)\.(ts|js|java)$/, ".$2")
        .replace(/Test\.java$/, ".java");
      testBaseNames.add(baseName);
    }
  }

  for (const src of sourceFiles) {
    const baseName = src.split(/[\/\\]/).pop() ?? "";
    if (baseName === "index.ts" || baseName === "index.js" || baseName.startsWith("types")) continue;

    if (!testBaseNames.has(src)) {
      findings.push({
        id: `TST-${String(counter++).padStart(3, "0")}`,
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

async function collectSourceFiles(dir: string, collected: string[] = []): Promise<string[]> {
  try {
    const entries = await readdir(dir, { withFileTypes: true });
    for (const entry of entries) {
      const fullPath = join(dir, entry.name);
      if (entry.name === "node_modules" || entry.name === "dist" || entry.name.startsWith(".")) continue;
      if (entry.isDirectory()) {
        await collectSourceFiles(fullPath, collected);
      } else if (SOURCE_EXTENSIONS.includes(extname(entry.name))) {
        collected.push(fullPath);
      }
    }
  } catch {
    /* directory not readable */
  }
  return collected;
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
