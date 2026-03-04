import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { mkdirSync, writeFileSync, rmSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { parseCoverage, detectMissingTests } from "../tools/tests.js";

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

  it("returns empty findings when no coverage files exist", async () => {
    const findings = await parseCoverage(tempDir);
    expect(findings).toEqual([]);
  });

  it("detects low line coverage", async () => {
    mkdirSync(join(tempDir, "coverage"), { recursive: true });
    writeFileSync(
      join(tempDir, "coverage", "coverage-summary.json"),
      JSON.stringify({ total: { lines: { pct: 50 }, branches: { pct: 90 }, functions: { pct: 90 } } }),
    );
    const findings = await parseCoverage(tempDir);
    expect(findings.some((f) => f.title.includes("lines"))).toBe(true);
  });
});

describe("detectMissingTests", () => {
  let tempDir: string;

  beforeEach(() => {
    tempDir = makeTempDir();
    mkdirSync(join(tempDir, "src"), { recursive: true });
    mkdirSync(join(tempDir, "__tests__"), { recursive: true });
  });
  afterEach(() => {
    rmSync(tempDir, { recursive: true, force: true });
  });

  it("detects source files without test counterpart", async () => {
    writeFileSync(join(tempDir, "src", "service.ts"), "export const x = 1;");
    const findings = await detectMissingTests(tempDir);
    expect(findings.some((f) => f.rule === "missing-test-file")).toBe(true);
  });

  it("recognizes matching test files", async () => {
    writeFileSync(join(tempDir, "src", "helper.ts"), "export const x = 1;");
    writeFileSync(join(tempDir, "__tests__", "helper.test.ts"), 'import "../src/helper.js";');
    const findings = await detectMissingTests(tempDir);
    const helperFindings = findings.filter((f) => f.evidence?.[0]?.file?.includes("helper"));
    expect(helperFindings).toHaveLength(0);
  });

  it("skips index files", async () => {
    writeFileSync(join(tempDir, "src", "index.ts"), "export {};");
    const findings = await detectMissingTests(tempDir);
    expect(findings.every((f) => !f.evidence?.[0]?.file?.includes("index"))).toBe(true);
  });
});
