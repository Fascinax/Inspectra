import { describe, it, expect } from "vitest";
import { compareReports, renderComparisonMarkdown } from "../renderer/compare.js";
import type { ConsolidatedReport, DomainReport } from "../types.js";

function makeDomainReport(overrides: Partial<DomainReport> = {}): DomainReport {
  return {
    domain: "security",
    score: 85,
    summary: "Test domain summary",
    findings: [],
    metadata: {
      agent: "test-agent",
      timestamp: "2024-01-01T00:00:00Z",
      tools_used: [],
    },
    ...overrides,
  };
}

function makeReport(overrides: Partial<ConsolidatedReport> = {}): ConsolidatedReport {
  return {
    overall_score: 85,
    grade: "B",
    summary: "Test consolidated summary",
    domain_reports: [makeDomainReport()],
    top_findings: [],
    metadata: {
      timestamp: "2024-01-01T00:00:00Z",
      target: "test-project",
      profile: "generic",
    },
    ...overrides,
  };
}

describe("compareReports", () => {
  it("computes overall score delta", () => {
    const reportA = makeReport({ overall_score: 90 });
    const reportB = makeReport({ overall_score: 80 });

    const result = compareReports(reportA, reportB);
    expect(result.overallDelta).toBe(10);
    expect(result.reportA.score).toBe(90);
    expect(result.reportB.score).toBe(80);
  });

  it("uses custom labels", () => {
    const reportA = makeReport();
    const reportB = makeReport();

    const result = compareReports(reportA, reportB, "Baseline", "Current");
    expect(result.reportA.label).toBe("Baseline");
    expect(result.reportB.label).toBe("Current");
  });

  it("compares domain scores", () => {
    const reportA = makeReport({
      domain_reports: [
        makeDomainReport({ domain: "security", score: 90 }),
        makeDomainReport({ domain: "tests", score: 80 }),
      ],
    });
    const reportB = makeReport({
      domain_reports: [
        makeDomainReport({ domain: "security", score: 85 }),
        makeDomainReport({ domain: "tests", score: 75 }),
      ],
    });

    const result = compareReports(reportA, reportB);
    expect(result.domains).toHaveLength(2);
    expect(result.domains[0].scoreA).toBe(90);
    expect(result.domains[0].scoreB).toBe(85);
    expect(result.domains[0].delta).toBe(5);
  });

  it("handles domains present in only one report", () => {
    const reportA = makeReport({
      domain_reports: [makeDomainReport({ domain: "security", score: 90 })],
    });
    const reportB = makeReport({
      domain_reports: [makeDomainReport({ domain: "tests", score: 80 })],
    });

    const result = compareReports(reportA, reportB);
    expect(result.domains).toHaveLength(2);
    
    const secDomain = result.domains.find((d) => d.domain === "security");
    expect(secDomain?.scoreA).toBe(90);
    expect(secDomain?.scoreB).toBe(100); // default when absent

    const testsDomain = result.domains.find((d) => d.domain === "tests");
    expect(testsDomain?.scoreA).toBe(100); // default when absent
    expect(testsDomain?.scoreB).toBe(80);
  });

  it("identifies added findings (unique to reportA)", () => {
    const reportA = makeReport({
      domain_reports: [
        makeDomainReport({
          findings: [
            {
              id: "SEC-001",
              severity: "high",
              title: "Existing finding",
              description: "Test",
              domain: "security",
              rule: "test-rule",
              confidence: 0.9,
              evidence: [{ file: "test.ts" }],
              recommendation: "Fix it",
              effort: "small",
              tags: [],
              source: "tool",
            },
            {
              id: "SEC-002",
              severity: "medium",
              title: "Extra finding in A",
              description: "Test",
              domain: "security",
              rule: "extra-rule",
              confidence: 0.8,
              evidence: [{ file: "a.ts" }],
              recommendation: "Fix it",
              effort: "small",
              tags: [],
              source: "tool",
            },
          ],
        }),
      ],
    });
    const reportB = makeReport({
      domain_reports: [
        makeDomainReport({
          findings: [
            {
              id: "SEC-001",
              severity: "high",
              title: "Existing finding",
              description: "Test",
              domain: "security",
              rule: "test-rule",
              confidence: 0.9,
              evidence: [{ file: "test.ts" }],
              recommendation: "Fix it",
              effort: "small",
              tags: [],
              source: "tool",
            },
          ],
        }),
      ],
    });

    const result = compareReports(reportA, reportB);
    expect(result.added).toHaveLength(1);
    expect(result.added[0].id).toBe("SEC-002");
    expect(result.unchanged).toHaveLength(1);
  });

  it("identifies removed findings (unique to reportB)", () => {
    const reportA = makeReport({
      domain_reports: [
        makeDomainReport({
          findings: [
            {
              id: "SEC-001",
              severity: "high",
              title: "Old finding",
              description: "Test",
              domain: "security",
              rule: "test-rule",
              confidence: 0.9,
              evidence: [{ file: "test.ts" }],
              recommendation: "Fix it",
              effort: "small",
              tags: [],
              source: "tool",
            },
          ],
        }),
      ],
    });
    const reportB = makeReport({
      domain_reports: [
        makeDomainReport({
          findings: [
            {
              id: "SEC-001",
              severity: "high",
              title: "Old finding",
              description: "Test",
              domain: "security",
              rule: "test-rule",
              confidence: 0.9,
              evidence: [{ file: "test.ts" }],
              recommendation: "Fix it",
              effort: "small",
              tags: [],
              source: "tool",
            },
            {
              id: "SEC-002",
              severity: "medium",
              title: "Fixed finding",
              description: "Test",
              domain: "security",
              rule: "old-rule",
              confidence: 0.8,
              evidence: [{ file: "old.ts" }],
              recommendation: "Fix it",
              effort: "small",
              tags: [],
              source: "tool",
            },
          ],
        }),
      ],
    });

    const result = compareReports(reportA, reportB);
    expect(result.removed).toHaveLength(1);
    expect(result.removed[0].id).toBe("SEC-002");
  });

  it("handles empty reports", () => {
    const reportA = makeReport({ domain_reports: [] });
    const reportB = makeReport({ domain_reports: [] });

    const result = compareReports(reportA, reportB);
    expect(result.overallDelta).toBe(0);
    expect(result.domains).toEqual([]);
  });
});

describe("renderComparisonMarkdown", () => {
  it("renders comparison summary", () => {
    const reportA = makeReport({ overall_score: 90, grade: "A" });
    const reportB = makeReport({ overall_score: 85, grade: "B" });

    const result = compareReports(reportA, reportB, "Baseline", "Current");
    const markdown = renderComparisonMarkdown(result);

    expect(markdown).toContain("## Audit Comparison");
    expect(markdown).toContain("Baseline");
    expect(markdown).toContain("Current");
    expect(markdown).toContain("90");
    expect(markdown).toContain("85");
  });

  it("renders added findings section", () => {
    const reportA = makeReport({ domain_reports: [makeDomainReport({ findings: [] })] });
    const reportB = makeReport({
      domain_reports: [
        makeDomainReport({
          findings: [
            {
              id: "SEC-001",
              severity: "high",
              title: "New vulnerability",
              description: "Test",
              domain: "security",
              rule: "test-rule",
              confidence: 0.9,
              evidence: [{ file: "test.ts" }],
              recommendation: "Fix it",
              effort: "small",
              tags: [],
              source: "tool",
            },
          ],
        }),
      ],
    });

    const result = compareReports(reportA, reportB);
    const markdown = renderComparisonMarkdown(result);

    expect(markdown).toContain("### Added Findings");
    expect(markdown).toContain("SEC-001");
    expect(markdown).toContain("New vulnerability");
  });

  it("renders removed findings section", () => {
    const reportA = makeReport({
      domain_reports: [
        makeDomainReport({
          findings: [
            {
              id: "SEC-001",
              severity: "high",
              title: "Fixed vulnerability",
              description: "Test",
              domain: "security",
              rule: "test-rule",
              confidence: 0.9,
              evidence: [{ file: "test.ts" }],
              recommendation: "Fix it",
              effort: "small",
              tags: [],
              source: "tool",
            },
          ],
        }),
      ],
    });
    const reportB = makeReport({ domain_reports: [makeDomainReport({ findings: [] })] });

    const result = compareReports(reportA, reportB);
    const markdown = renderComparisonMarkdown(result);

    expect(markdown).toContain("### Removed Findings");
    expect(markdown).toContain("SEC-001");
    expect(markdown).toContain("Fixed vulnerability");
  });
});
