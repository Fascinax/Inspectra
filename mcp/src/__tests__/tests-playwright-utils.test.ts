import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { mkdirSync, writeFileSync, rmSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { walkSuites, loadPlaywrightReport } from "../tools/tests-playwright-utils.js";
import type { PlaywrightSuite, SuiteVisitor } from "../tools/tests-playwright-utils.js";

describe("walkSuites", () => {
  it("visits each test in flat suites", () => {
    const visited: Array<{ title: string; path: string }> = [];
    const visitor: SuiteVisitor = (test, path) => visited.push({ title: test.title, path });

    const suites: PlaywrightSuite[] = [
      { title: "Login", tests: [{ title: "valid credentials" }, { title: "invalid password" }] },
    ];

    walkSuites(suites, visitor);
    expect(visited).toEqual([
      { title: "valid credentials", path: "Login" },
      { title: "invalid password", path: "Login" },
    ]);
  });

  it("visits tests in nested suites with accumulated path", () => {
    const visited: Array<{ title: string; path: string }> = [];
    const visitor: SuiteVisitor = (test, path) => visited.push({ title: test.title, path });

    const suites: PlaywrightSuite[] = [
      {
        title: "Auth",
        suites: [{ title: "Login", tests: [{ title: "shows form" }] }],
        tests: [{ title: "redirects to login" }],
      },
    ];

    walkSuites(suites, visitor);
    expect(visited).toContainEqual({ title: "shows form", path: "Auth > Login" });
    expect(visited).toContainEqual({ title: "redirects to login", path: "Auth" });
  });

  it("handles empty suites gracefully", () => {
    const visited: string[] = [];
    walkSuites([], (test) => visited.push(test.title));
    expect(visited).toEqual([]);
  });

  it("handles suites with no tests property", () => {
    const visited: string[] = [];
    walkSuites([{ title: "Empty" }], (test) => visited.push(test.title));
    expect(visited).toEqual([]);
  });
});

describe("loadPlaywrightReport", () => {
  let tempDir: string;

  beforeEach(() => {
    tempDir = join(tmpdir(), `inspectra-pw-${Date.now()}-${Math.random().toString(36).slice(2)}`);
    mkdirSync(tempDir, { recursive: true });
  });

  afterEach(() => {
    rmSync(tempDir, { recursive: true, force: true });
  });

  it("loads from playwright-report/results.json", async () => {
    const report = { suites: [{ title: "Test", tests: [] }] };
    const dir = join(tempDir, "playwright-report");
    mkdirSync(dir, { recursive: true });
    writeFileSync(join(dir, "results.json"), JSON.stringify(report));

    const loaded = await loadPlaywrightReport(tempDir);
    expect(loaded).not.toBeNull();
    expect(loaded!.report.suites).toHaveLength(1);
    expect(loaded!.relativePath).toContain("results.json");
  });

  it("falls back to test-results/results.json", async () => {
    const report = { suites: [] };
    const dir = join(tempDir, "test-results");
    mkdirSync(dir, { recursive: true });
    writeFileSync(join(dir, "results.json"), JSON.stringify(report));

    const loaded = await loadPlaywrightReport(tempDir);
    expect(loaded).not.toBeNull();
    expect(loaded!.relativePath).toContain("test-results");
  });

  it("falls back to test-results.json", async () => {
    const report = { suites: [] };
    writeFileSync(join(tempDir, "test-results.json"), JSON.stringify(report));

    const loaded = await loadPlaywrightReport(tempDir);
    expect(loaded).not.toBeNull();
  });

  it("returns null when no report file exists", async () => {
    const loaded = await loadPlaywrightReport(tempDir);
    expect(loaded).toBeNull();
  });
});
