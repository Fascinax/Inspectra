import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { mkdirSync, writeFileSync, rmSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { analyzeBundleSize, checkBuildTimings, detectRuntimeMetrics } from "../tools/performance.js";

function makeTempDir(): string {
  const dir = join(tmpdir(), `inspectra-test-${Date.now()}-${Math.random().toString(36).slice(2)}`);
  mkdirSync(dir, { recursive: true });
  return dir;
}

describe("analyzeBundleSize", () => {
  let tempDir: string;

  beforeEach(() => {
    tempDir = makeTempDir();
  });
  afterEach(() => {
    rmSync(tempDir, { recursive: true, force: true });
  });

  it("returns empty findings for project without build artifacts", async () => {
    const findings = await analyzeBundleSize(tempDir);
    expect(findings).toEqual([]);
  });

  it("detects large assets from stats.json", async () => {
    mkdirSync(join(tempDir, "dist"), { recursive: true });
    writeFileSync(
      join(tempDir, "dist", "stats.json"),
      JSON.stringify({ assets: [{ name: "bundle.js", size: 600 * 1024 }] }),
    );
    const findings = await analyzeBundleSize(tempDir);
    expect(findings.some((f) => f.rule === "bundle-size-threshold")).toBe(true);
  });
});

describe("checkBuildTimings", () => {
  let tempDir: string;

  beforeEach(() => {
    tempDir = makeTempDir();
  });
  afterEach(() => {
    rmSync(tempDir, { recursive: true, force: true });
  });

  it("returns empty findings when no build timing data exists", async () => {
    const findings = await checkBuildTimings(tempDir);
    expect(findings).toEqual([]);
  });
});

describe("detectRuntimeMetrics", () => {
  let tempDir: string;

  beforeEach(() => {
    tempDir = makeTempDir();
  });
  afterEach(() => {
    rmSync(tempDir, { recursive: true, force: true });
  });

  it("returns empty findings for empty project", async () => {
    const findings = await detectRuntimeMetrics(tempDir);
    expect(findings).toEqual([]);
  });

  it("detects synchronous fs usage", async () => {
    mkdirSync(join(tempDir, "src"), { recursive: true });
    writeFileSync(join(tempDir, "src", "app.ts"), 'import { readFileSync } from "fs";\nreadFileSync("x");\n');
    const findings = await detectRuntimeMetrics(tempDir);
    expect(findings.some((f) => f.rule === "sync-fs-usage")).toBe(true);
  });
});
