import { describe, it, expect } from "vitest";
import { parseCompareArgs, extractCompareFlag } from "../cli/compare.js";

// ─── extractCompareFlag ───────────────────────────────────────────────────────

describe("extractCompareFlag", () => {
  it("extracts the label-a flag", () => {
    expect(extractCompareFlag(["baseline.json", "current.json", "--label-a=main"], "--label-a")).toBe("main");
  });

  it("extracts the label-b flag", () => {
    expect(extractCompareFlag(["--label-b=feature/auth"], "--label-b")).toBe("feature/auth");
  });

  it("extracts the output flag", () => {
    expect(extractCompareFlag(["--output=diff.md"], "--output")).toBe("diff.md");
  });

  it("returns undefined when the flag is absent", () => {
    expect(extractCompareFlag(["--label-b=current"], "--label-a")).toBeUndefined();
  });

  it("returns undefined for an empty args array", () => {
    expect(extractCompareFlag([], "--label-a")).toBeUndefined();
  });

  it("does not match partial flag names", () => {
    expect(extractCompareFlag(["--label-aa=x"], "--label-a")).toBeUndefined();
  });

  it("handles flag values with slashes (branch names)", () => {
    expect(extractCompareFlag(["--label-b=feature/login-v2"], "--label-b")).toBe("feature/login-v2");
  });
});

// ─── parseCompareArgs ─────────────────────────────────────────────────────────

describe("parseCompareArgs", () => {
  it("extracts baseline and current paths", () => {
    const opts = parseCompareArgs(["node", "compare.js", "baseline.json", "current.json"]);
    expect(opts.baselinePath).toMatch(/baseline\.json$/);
    expect(opts.currentPath).toMatch(/current\.json$/);
  });

  it("defaults labelA to Baseline", () => {
    const opts = parseCompareArgs(["node", "compare.js", "a.json", "b.json"]);
    expect(opts.labelA).toBe("Baseline");
  });

  it("defaults labelB to Current", () => {
    const opts = parseCompareArgs(["node", "compare.js", "a.json", "b.json"]);
    expect(opts.labelB).toBe("Current");
  });

  it("captures custom labelA", () => {
    const opts = parseCompareArgs(["node", "compare.js", "a.json", "b.json", "--label-a=main"]);
    expect(opts.labelA).toBe("main");
  });

  it("captures custom labelB", () => {
    const opts = parseCompareArgs(["node", "compare.js", "a.json", "b.json", "--label-b=feature/auth"]);
    expect(opts.labelB).toBe("feature/auth");
  });

  it("returns null output when --output is absent", () => {
    const opts = parseCompareArgs(["node", "compare.js", "a.json", "b.json"]);
    expect(opts.output).toBeNull();
  });

  it("captures --output path", () => {
    const opts = parseCompareArgs(["node", "compare.js", "a.json", "b.json", "--output=diff.md"]);
    expect(opts.output).toMatch(/diff\.md$/);
  });

  it("resolves paths to absolute", () => {
    const opts = parseCompareArgs(["node", "compare.js", "a.json", "b.json"]);
    // Matches Unix /… and Windows C:\… absolute paths
    expect(opts.baselinePath).toMatch(/^([a-zA-Z]:[/\\]|[/\\])/);
    expect(opts.currentPath).toMatch(/^([a-zA-Z]:[/\\]|[/\\])/);
  });

  it("tolerates flags between positional args", () => {
    const opts = parseCompareArgs(["node", "compare.js", "a.json", "--label-a=main", "b.json"]);
    expect(opts.baselinePath).toMatch(/a\.json$/);
    expect(opts.currentPath).toMatch(/b\.json$/);
  });
});
