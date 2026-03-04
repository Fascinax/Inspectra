import { describe, it, expect } from "vitest";
import { renderMarkdown, renderFindingsAsMarkdown } from "../renderer/markdown.js";
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

describe("renderMarkdown", () => {
  it("renders a string containing the report heading", () => {
    const output = renderMarkdown(makeReport());
    expect(output).toContain("# Inspectra Audit Report");
  });

  it("includes the overall score", () => {
    const output = renderMarkdown(makeReport({ overall_score: 42 }));
    expect(output).toContain("42");
  });

  it("includes the grade", () => {
    const output = renderMarkdown(makeReport({ grade: "A" }));
    expect(output).toContain("A");
  });

  it("includes domain names", () => {
    const output = renderMarkdown(makeReport());
    expect(output).toContain("Security");
  });
});

describe("renderFindingsAsMarkdown", () => {
  it("renders findings as a markdown table or list", () => {
    const findings = [makeFinding({ title: "Test finding" })];
    const output = renderFindingsAsMarkdown(findings);
    expect(output).toContain("Test finding");
  });

  it("handles empty findings array", () => {
    const output = renderFindingsAsMarkdown([]);
    expect(typeof output).toBe("string");
  });
});
