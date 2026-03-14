import { describe, it, expect } from "vitest";
import { renderMarkdown, renderFindingsAsMarkdown } from "../renderer/markdown.js";
import type { ConsolidatedReport } from "../types.js";
import type { RootCauseCluster } from "../merger/root-cause.js";
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

function makeCluster(): RootCauseCluster {
  const finding = makeFinding({ id: "SEC-101", severity: "high", domain: "security" });
  return {
    category: "security-shortcut",
    source: "tool",
    confidence: 0.9,
    rationale: "Security controls are applied inconsistently across modules.",
    hotspot_count: 1,
    finding_count: 1,
    domain_count: 1,
    domains: ["security"],
    severity_ceiling: "high",
    hotspots: [
      {
        type: "file",
        key: "src/auth.ts",
        label: "src/auth.ts",
        finding_count: 1,
        domain_count: 1,
        domains: ["security"],
        severity_ceiling: "high",
        findings: [finding],
      },
    ],
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

  it("renders diagnosis-first section headings", () => {
    const output = renderMarkdown(makeReport());
    expect(output).toContain("## Executive Diagnosis");
    expect(output).toContain("## Remediation Plan");
    expect(output).toContain("## Root Cause Analysis");
    expect(output).toContain("## Domain Breakdown");
    expect(output).toContain("## Score Context");
  });

  it("renders provided root cause clusters in analysis section", () => {
    const report = makeReport() as ConsolidatedReport & { clusters: RootCauseCluster[] };
    report.clusters = [makeCluster()];

    const output = renderMarkdown(report);
    expect(output).toContain("Security Shortcut");
    expect(output).toContain("Contributing Findings");
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
