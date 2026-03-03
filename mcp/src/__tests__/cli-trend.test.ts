import { describe, it, expect } from "vitest";
import { parseTrendArgs, extractTrendFlag } from "../cli/trend.js";

// ─── extractTrendFlag ─────────────────────────────────────────────────────────

describe("extractTrendFlag", () => {
  it("extracts the output flag", () => {
    expect(extractTrendFlag(["report1.json", "report2.json", "--output=trend.md"], "--output")).toBe("trend.md");
  });

  it("returns undefined when the flag is absent", () => {
    expect(extractTrendFlag(["report1.json"], "--output")).toBeUndefined();
  });

  it("returns undefined for an empty args array", () => {
    expect(extractTrendFlag([], "--output")).toBeUndefined();
  });

  it("returns an empty string when value is empty", () => {
    expect(extractTrendFlag(["--output="], "--output")).toBe("");
  });

  it("does not match partial flag names", () => {
    expect(extractTrendFlag(["--outputs=trend.md"], "--output")).toBeUndefined();
  });

  it("handles paths with separators", () => {
    expect(extractTrendFlag(["--output=/reports/trend.md"], "--output")).toBe("/reports/trend.md");
  });
});

// ─── parseTrendArgs ───────────────────────────────────────────────────────────

describe("parseTrendArgs", () => {
  it("extracts positional report paths", () => {
    const opts = parseTrendArgs(["node", "trend.js", "jan.json", "feb.json"]);
    expect(opts.reportPaths).toHaveLength(2);
    expect(opts.reportPaths[0]).toMatch(/jan\.json$/);
    expect(opts.reportPaths[1]).toMatch(/feb\.json$/);
  });

  it("returns null output when --output is absent", () => {
    const opts = parseTrendArgs(["node", "trend.js", "a.json", "b.json"]);
    expect(opts.output).toBeNull();
  });

  it("captures --output value", () => {
    const opts = parseTrendArgs(["node", "trend.js", "a.json", "b.json", "--output=trend.md"]);
    expect(opts.output).toMatch(/trend\.md$/);
  });

  it("ignores flags when collecting positional paths", () => {
    const opts = parseTrendArgs(["node", "trend.js", "a.json", "--output=out.md", "b.json", "c.json"]);
    expect(opts.reportPaths).toHaveLength(3);
  });

  it("resolves relative paths to absolute paths", () => {
    const opts = parseTrendArgs(["node", "trend.js", "a.json"]);
    // Matches Unix /… and Windows C:\… absolute paths
    expect(opts.reportPaths[0]).toMatch(/^([a-zA-Z]:[/\\]|[/\\])/);
  });

  it("supports three or more report files", () => {
    const opts = parseTrendArgs(["node", "trend.js", "jan.json", "feb.json", "mar.json", "apr.json"]);
    expect(opts.reportPaths).toHaveLength(4);
  });
});
