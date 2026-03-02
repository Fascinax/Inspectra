import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { mkdirSync, writeFileSync, rmSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { parseCoverage, parseTestResults, detectMissingTests } from "../tools/tests.js";

function makeTempDir(): string {
  const dir = join(tmpdir(), `inspectra-test-${Date.now()}-${Math.random().toString(36).slice(2)}`);
  mkdirSync(dir, { recursive: true });
  return dir;
}

describe("parseCoverage", () => {
  let tempDir: string;

  beforeEach(() => {
    tempDir = makeTempDir();
  });
  afterEach(() => {
    rmSync(tempDir, { recursive: true, force: true });
  });

  it("flags coverage below default thresholds", async () => {
    const coverageDir = join(tempDir, "coverage");
    mkdirSync(coverageDir, { recursive: true });
    writeFileSync(
      join(coverageDir, "coverage-summary.json"),
      JSON.stringify({
        total: {
          lines: { pct: 50.0 },
          branches: { pct: 40.0 },
          functions: { pct: 60.0 },
        },
      }),
    );

    const findings = await parseCoverage(tempDir);
    expect(findings.length).toBe(3);
    expect(findings.map((f) => f.rule)).toEqual([
      "low-lines-coverage",
      "low-branches-coverage",
      "low-functions-coverage",
    ]);
  });

  it("respects profile thresholds", async () => {
    const coverageDir = join(tempDir, "coverage");
    mkdirSync(coverageDir, { recursive: true });
    writeFileSync(
      join(coverageDir, "coverage-summary.json"),
      JSON.stringify({
        total: {
          lines: { pct: 70.0 },
          branches: { pct: 60.0 },
          functions: { pct: 70.0 },
        },
      }),
    );

    // Default thresholds: lines 80, branches 70, functions 75 → 3 findings
    const defaultFindings = await parseCoverage(tempDir);
    expect(defaultFindings.length).toBe(3);

    // Relaxed profile: lines 60, branches 50, functions 60 → 0 findings
    const relaxedProfile = {
      profile: "relaxed",
      coverage: {
        lines: { minimum: 50, target: 60 },
        branches: { minimum: 40, target: 50 },
        functions: { minimum: 50, target: 60 },
      },
    };
    const relaxedFindings = await parseCoverage(tempDir, relaxedProfile);
    expect(relaxedFindings.length).toBe(0);
  });

  it("returns empty when no coverage file exists", async () => {
    const findings = await parseCoverage(tempDir);
    expect(findings.length).toBe(0);
  });

  it("marks very low coverage as high severity", async () => {
    const coverageDir = join(tempDir, "coverage");
    mkdirSync(coverageDir, { recursive: true });
    writeFileSync(
      join(coverageDir, "coverage-summary.json"),
      JSON.stringify({
        total: { lines: { pct: 30.0 } },
      }),
    );

    const findings = await parseCoverage(tempDir);
    expect(findings[0].severity).toBe("high");
  });
});

describe("parseTestResults", () => {
  let tempDir: string;

  beforeEach(() => {
    tempDir = makeTempDir();
  });
  afterEach(() => {
    rmSync(tempDir, { recursive: true, force: true });
  });

  it("detects failing tests from JUnit XML", async () => {
    const resultsDir = join(tempDir, "test-results");
    mkdirSync(resultsDir, { recursive: true });
    writeFileSync(
      join(resultsDir, "junit.xml"),
      `<?xml version="1.0"?>
<testsuites>
  <testsuite name="auth">
    <testcase name="should authenticate user" classname="auth.test">
      <failure message="Expected true but got false">assert failed</failure>
    </testcase>
    <testcase name="should hash password" classname="auth.test" />
  </testsuite>
</testsuites>`,
    );

    const findings = await parseTestResults(tempDir);
    expect(findings.length).toBe(1);
    expect(findings[0].title).toContain("should authenticate user");
    expect(findings[0].severity).toBe("high");
  });

  it("returns empty when no JUnit file exists", async () => {
    const findings = await parseTestResults(tempDir);
    expect(findings.length).toBe(0);
  });

  it("returns empty when all tests pass", async () => {
    const resultsDir = join(tempDir, "test-results");
    mkdirSync(resultsDir, { recursive: true });
    writeFileSync(
      join(resultsDir, "junit.xml"),
      `<?xml version="1.0"?>
<testsuites>
  <testsuite name="math">
    <testcase name="adds numbers" classname="math.test" />
  </testsuite>
</testsuites>`,
    );

    const findings = await parseTestResults(tempDir);
    expect(findings.length).toBe(0);
  });
});

describe("detectMissingTests", () => {
  let tempDir: string;

  beforeEach(() => {
    tempDir = makeTempDir();
  });
  afterEach(() => {
    rmSync(tempDir, { recursive: true, force: true });
  });

  it("flags source files without corresponding test files", async () => {
    const srcDir = join(tempDir, "src");
    mkdirSync(srcDir, { recursive: true });
    writeFileSync(join(srcDir, "auth.ts"), "export function login() {}\n");
    writeFileSync(join(srcDir, "utils.ts"), "export function format() {}\n");

    const findings = await detectMissingTests(tempDir);
    expect(findings.length).toBe(2);
    expect(findings[0].rule).toBe("missing-test-file");
  });

  it("does not flag source files that have test files", async () => {
    const srcDir = join(tempDir, "src");
    mkdirSync(srcDir, { recursive: true });
    writeFileSync(join(srcDir, "auth.ts"), "export function login() {}\n");
    writeFileSync(join(srcDir, "auth.test.ts"), "test('login', () => {});\n");

    const findings = await detectMissingTests(tempDir);
    expect(findings.length).toBe(0);
  });

  it("skips index.ts and types files", async () => {
    const srcDir = join(tempDir, "src");
    mkdirSync(srcDir, { recursive: true });
    writeFileSync(join(srcDir, "index.ts"), "export * from './auth';\n");
    writeFileSync(join(srcDir, "types.ts"), "export type User = {};\n");

    const findings = await detectMissingTests(tempDir);
    expect(findings.length).toBe(0);
  });

  it("supports .java files", async () => {
    const srcDir = join(tempDir, "src");
    mkdirSync(srcDir, { recursive: true });
    writeFileSync(join(srcDir, "UserService.java"), "public class UserService {}\n");

    const findings = await detectMissingTests(tempDir);
    expect(findings.length).toBe(1);
  });

  it("returns empty for empty directory", async () => {
    const findings = await detectMissingTests(tempDir);
    expect(findings.length).toBe(0);
  });
});
