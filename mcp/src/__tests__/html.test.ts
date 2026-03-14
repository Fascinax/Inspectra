import { describe, it, expect } from "vitest";
import { renderHtml } from "../renderer/html.js";
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

describe("renderHtml", () => {
  it("returns an HTML string", () => {
    const output = renderHtml(makeReport());
    expect(output).toContain("<!DOCTYPE html>");
  });

  it("includes the report title", () => {
    const output = renderHtml(makeReport());
    expect(output).toContain("Inspectra");
  });

  it("includes the overall score", () => {
    const output = renderHtml(makeReport({ overall_score: 88 }));
    expect(output).toContain("88");
  });

  it("includes the grade", () => {
    const output = renderHtml(makeReport({ grade: "A" }));
    expect(output).toContain("A");
  });

  it("contains embedded CSS (self-contained)", () => {
    const output = renderHtml(makeReport());
    expect(output).toContain("<style>");
  });

  it("renders diagnosis-first sections", () => {
    const output = renderHtml(makeReport());
    expect(output).toContain("Executive Diagnosis");
    expect(output).toContain("Remediation Plan");
    expect(output).toContain("Root Cause Analysis");
    expect(output).toContain("Domain Breakdown");
    expect(output).toContain("Score Context");
  });

  it("renders remediation table columns", () => {
    const output = renderHtml(makeReport());
    expect(output).toContain("Est. Score Delta");
    expect(output).toContain("Dependencies");
  });
});
