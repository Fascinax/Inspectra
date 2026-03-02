import { describe, it, expect } from "vitest";
import { extractFlag, buildDomainReport } from "../cli/audit.js";
import { makeFinding } from "./fixtures.js";

// ─── extractFlag ─────────────────────────────────────────────────────────────

describe("extractFlag", () => {
  it("extracts a simple flag value", () => {
    expect(extractFlag(["./project", "--profile=java-backend"], "--profile")).toBe("java-backend");
  });

  it("extracts the output flag", () => {
    expect(extractFlag(["./project", "--output=report.md"], "--output")).toBe("report.md");
  });

  it("extracts a flag with a value containing special characters", () => {
    expect(extractFlag(["--format=markdown"], "--format")).toBe("markdown");
  });

  it("returns undefined when the flag is absent", () => {
    expect(extractFlag(["./project", "--format=json"], "--profile")).toBeUndefined();
  });

  it("returns undefined for an empty args array", () => {
    expect(extractFlag([], "--profile")).toBeUndefined();
  });

  it("returns the first matching flag when duplicates appear", () => {
    expect(extractFlag(["--profile=a", "--profile=b"], "--profile")).toBe("a");
  });

  it("does not match partial flag names (--profiles not matched by --profile)", () => {
    expect(extractFlag(["--profiles=all"], "--profile")).toBeUndefined();
  });

  it("handles flag value with path separators", () => {
    expect(extractFlag(["--output=/tmp/report.md"], "--output")).toBe("/tmp/report.md");
  });

  it("handles flag value equal to empty string", () => {
    expect(extractFlag(["--output="], "--output")).toBe("");
  });
});

// ─── buildDomainReport ───────────────────────────────────────────────────────

describe("buildDomainReport", () => {
  it("returns 'No issues found' summary when findings is empty", () => {
    const report = buildDomainReport("security", "audit-security", [], 100, Date.now(), ["scan-secrets"]);
    expect(report.summary).toBe("No issues found");
  });

  it("assigns the correct domain", () => {
    const report = buildDomainReport("tests", "audit-tests", [], 100, Date.now(), []);
    expect(report.domain).toBe("tests");
  });

  it("sets the agent in metadata", () => {
    const report = buildDomainReport("architecture", "audit-architecture", [], 90, Date.now(), ["check-layering"]);
    expect(report.metadata?.agent).toBe("audit-architecture");
  });

  it("includes tools_used in metadata", () => {
    const tools = ["scan-secrets", "check-deps-vulns"];
    const report = buildDomainReport("security", "audit-security", [], 80, Date.now(), tools);
    expect(report.metadata?.tools_used).toEqual(tools);
  });

  it("computes duration_ms as a positive number", () => {
    const start = Date.now() - 500;
    const report = buildDomainReport("conventions", "audit-conventions", [], 75, start, []);
    expect(report.metadata?.duration_ms).toBeGreaterThan(0);
  });

  it("includes all findings in the report", () => {
    const findings = [makeFinding({ id: "SEC-001" }), makeFinding({ id: "SEC-002" })];
    const report = buildDomainReport("security", "audit-security", findings, 70, Date.now(), []);
    expect(report.findings).toHaveLength(2);
  });

  it("summarises severity counts in the summary string", () => {
    const findings = [
      makeFinding({ severity: "high" }),
      makeFinding({ severity: "high" }),
      makeFinding({ severity: "low" }),
    ];
    const report = buildDomainReport("security", "audit-security", findings, 60, Date.now(), []);
    expect(report.summary).toContain("2 high");
    expect(report.summary).toContain("1 low");
  });

  it("omits zero-count severities from summary", () => {
    const findings = [makeFinding({ severity: "critical" })];
    const report = buildDomainReport("security", "audit-security", findings, 40, Date.now(), []);
    expect(report.summary).not.toContain("0");
    expect(report.summary).toContain("1 critical");
  });

  it("stores the provided score", () => {
    const report = buildDomainReport("tests", "audit-tests", [], 83, Date.now(), []);
    expect(report.score).toBe(83);
  });

  it("sets a valid ISO timestamp in metadata", () => {
    const report = buildDomainReport("conventions", "audit-conventions", [], 100, Date.now(), []);
    expect(() => new Date(report.metadata!.timestamp!).toISOString()).not.toThrow();
  });

  it("handles mixed severity findings correctly", () => {
    const findings = [
      makeFinding({ severity: "critical" }),
      makeFinding({ severity: "high" }),
      makeFinding({ severity: "medium" }),
      makeFinding({ severity: "medium" }),
      makeFinding({ severity: "info" }),
    ];
    const report = buildDomainReport("security", "audit-security", findings, 30, Date.now(), []);
    expect(report.summary).toContain("1 critical");
    expect(report.summary).toContain("1 high");
    expect(report.summary).toContain("2 medium");
    expect(report.summary).toContain("1 info");
  });
});
