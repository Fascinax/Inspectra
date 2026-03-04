import { describe, it, expect } from "vitest";
import { renderJson } from "../renderer/json.js";
import type { ConsolidatedReport } from "../types.js";
import { makeFinding, makeDomainReport } from "./fixtures.js";

function makeReport(overrides: Partial<ConsolidatedReport> = {}): ConsolidatedReport {
  return {
    overall_score: 75,
    grade: "B",
    summary: "Test audit report",
    domain_reports: [makeDomainReport()],
    top_findings: [makeFinding()],
    statistics: { total_findings: 1 },
    metadata: {
      timestamp: "2026-03-04T10:00:00.000Z",
      target: "/test",
      profile: "generic",
    },
    ...overrides,
  };
}

describe("renderJson", () => {
  it("returns valid JSON string", () => {
    const report = makeReport();
    const output = renderJson(report);
    expect(() => JSON.parse(output)).not.toThrow();
  });

  it("preserves overall_score in output", () => {
    const report = makeReport({ overall_score: 42 });
    const parsed = JSON.parse(renderJson(report));
    expect(parsed.overall_score).toBe(42);
  });

  it("pretty-prints with 2-space indentation", () => {
    const output = renderJson(makeReport());
    expect(output).toContain("\n  ");
  });

  it("round-trips the report", () => {
    const report = makeReport();
    const parsed = JSON.parse(renderJson(report));
    expect(parsed.grade).toBe(report.grade);
    expect(parsed.domain_reports).toHaveLength(1);
  });
});
