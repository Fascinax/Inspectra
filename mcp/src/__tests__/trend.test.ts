import { describe, it, expect } from "vitest";
import { buildTrendEntry, analyzeTrend, renderTrendMarkdown } from "../renderer/trend.js";
import type { ConsolidatedReport, DomainReport } from "../types.js";

function makeDomainReport(overrides: Partial<DomainReport> = {}): DomainReport {
  return {
    domain: "security",
    score: 85,
    findings: [],
    metadata: {
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
    domain_reports: [makeDomainReport()],
    metadata: {
      timestamp: "2024-01-01T00:00:00Z",
      target: "test-project",
      profile: "generic",
      scan_context: "full",
    },
    statistics: {
      total_findings: 5,
      by_severity: { critical: 0, high: 1, medium: 2, low: 2, info: 0 },
      by_domain: { security: 5 },
      by_confidence: { tool: 3, llm: 2 },
    },
    ...overrides,
  };
}

describe("buildTrendEntry", () => {
  it("extracts timestamp from report", () => {
    const report = makeReport({ metadata: { ...makeReport().metadata, timestamp: "2024-03-01T12:00:00Z" } });
    const entry = buildTrendEntry(report);
    expect(entry.timestamp).toBe("2024-03-01T12:00:00Z");
  });

  it("extracts overall score", () => {
    const report = makeReport({ overall_score: 92 });
    const entry = buildTrendEntry(report);
    expect(entry.overall_score).toBe(92);
  });

  it("extracts grade", () => {
    const report = makeReport({ grade: "A" });
    const entry = buildTrendEntry(report);
    expect(entry.grade).toBe("A");
  });

  it("extracts total findings from statistics", () => {
    const report = makeReport({ statistics: { ...makeReport().statistics!, total_findings: 12 } });
    const entry = buildTrendEntry(report);
    expect(entry.total_findings).toBe(12);
  });

  it("builds domain scores map", () => {
    const report = makeReport({
      domain_reports: [
        makeDomainReport({ domain: "security", score: 90 }),
        makeDomainReport({ domain: "tests", score: 85 }),
        makeDomainReport({ domain: "architecture", score: 80 }),
      ],
    });
    const entry = buildTrendEntry(report);
    expect(entry.domain_scores).toEqual({
      security: 90,
      tests: 85,
      architecture: 80,
    });
  });

  it("handles reports with no statistics", () => {
    const report = makeReport({ statistics: undefined });
    const entry = buildTrendEntry(report);
    expect(entry.total_findings).toBe(0);
  });
});

describe("analyzeTrend", () => {
  it("returns empty trend for empty entries", () => {
    const trend = analyzeTrend([]);
    expect(trend.entries).toEqual([]);
    expect(trend.direction).toBe("stable");
    expect(trend.averageScore).toBe(0);
    expect(trend.bestScore).toBe(0);
    expect(trend.worstScore).toBe(0);
    expect(trend.scoreChange).toBe(0);
  });

  it("sorts entries by timestamp", () => {
    const entries = [
      { timestamp: "2024-03-01T00:00:00Z", overall_score: 80, grade: "B" as const, total_findings: 5, domain_scores: {} },
      { timestamp: "2024-01-01T00:00:00Z", overall_score: 70, grade: "C" as const, total_findings: 8, domain_scores: {} },
      { timestamp: "2024-02-01T00:00:00Z", overall_score: 75, grade: "B" as const, total_findings: 6, domain_scores: {} },
    ];
    const trend = analyzeTrend(entries);
    expect(trend.entries[0].timestamp).toBe("2024-01-01T00:00:00Z");
    expect(trend.entries[1].timestamp).toBe("2024-02-01T00:00:00Z");
    expect(trend.entries[2].timestamp).toBe("2024-03-01T00:00:00Z");
  });

  it("computes average score", () => {
    const entries = [
      { timestamp: "2024-01-01T00:00:00Z", overall_score: 80, grade: "B" as const, total_findings: 5, domain_scores: {} },
      { timestamp: "2024-02-01T00:00:00Z", overall_score: 90, grade: "A" as const, total_findings: 3, domain_scores: {} },
      { timestamp: "2024-03-01T00:00:00Z", overall_score: 85, grade: "B" as const, total_findings: 4, domain_scores: {} },
    ];
    const trend = analyzeTrend(entries);
    expect(trend.averageScore).toBe(85); // (80 + 90 + 85) / 3 = 85
  });

  it("identifies best and worst scores", () => {
    const entries = [
      { timestamp: "2024-01-01T00:00:00Z", overall_score: 70, grade: "C" as const, total_findings: 8, domain_scores: {} },
      { timestamp: "2024-02-01T00:00:00Z", overall_score: 95, grade: "A" as const, total_findings: 2, domain_scores: {} },
      { timestamp: "2024-03-01T00:00:00Z", overall_score: 80, grade: "B" as const, total_findings: 5, domain_scores: {} },
    ];
    const trend = analyzeTrend(entries);
    expect(trend.bestScore).toBe(95);
    expect(trend.worstScore).toBe(70);
  });

  it("computes score change from first to last", () => {
    const entries = [
      { timestamp: "2024-01-01T00:00:00Z", overall_score: 70, grade: "C" as const, total_findings: 8, domain_scores: {} },
      { timestamp: "2024-02-01T00:00:00Z", overall_score: 75, grade: "B" as const, total_findings: 6, domain_scores: {} },
      { timestamp: "2024-03-01T00:00:00Z", overall_score: 85, grade: "B" as const, total_findings: 4, domain_scores: {} },
    ];
    const trend = analyzeTrend(entries);
    expect(trend.scoreChange).toBe(15); // 85 - 70
  });

  it("detects improving direction", () => {
    const entries = [
      { timestamp: "2024-01-01T00:00:00Z", overall_score: 70, grade: "C" as const, total_findings: 8, domain_scores: {} },
      { timestamp: "2024-02-01T00:00:00Z", overall_score: 80, grade: "B" as const, total_findings: 5, domain_scores: {} },
      { timestamp: "2024-03-01T00:00:00Z", overall_score: 90, grade: "A" as const, total_findings: 2, domain_scores: {} },
    ];
    const trend = analyzeTrend(entries);
    expect(trend.direction).toBe("improving");
  });

  it("detects declining direction", () => {
    const entries = [
      { timestamp: "2024-01-01T00:00:00Z", overall_score: 90, grade: "A" as const, total_findings: 2, domain_scores: {} },
      { timestamp: "2024-02-01T00:00:00Z", overall_score: 80, grade: "B" as const, total_findings: 5, domain_scores: {} },
      { timestamp: "2024-03-01T00:00:00Z", overall_score: 70, grade: "C" as const, total_findings: 8, domain_scores: {} },
    ];
    const trend = analyzeTrend(entries);
    expect(trend.direction).toBe("declining");
  });

  it("detects stable direction", () => {
    const entries = [
      { timestamp: "2024-01-01T00:00:00Z", overall_score: 80, grade: "B" as const, total_findings: 5, domain_scores: {} },
      { timestamp: "2024-02-01T00:00:00Z", overall_score: 81, grade: "B" as const, total_findings: 5, domain_scores: {} },
      { timestamp: "2024-03-01T00:00:00Z", overall_score: 79, grade: "B" as const, total_findings: 5, domain_scores: {} },
    ];
    const trend = analyzeTrend(entries);
    expect(trend.direction).toBe("stable");
  });

  it("handles single entry", () => {
    const entries = [
      { timestamp: "2024-01-01T00:00:00Z", overall_score: 85, grade: "B" as const, total_findings: 4, domain_scores: {} },
    ];
    const trend = analyzeTrend(entries);
    expect(trend.direction).toBe("stable");
    expect(trend.scoreChange).toBe(0);
    expect(trend.averageScore).toBe(85);
  });
});

describe("renderTrendMarkdown", () => {
  it("returns message for empty trend", () => {
    const trend = analyzeTrend([]);
    const markdown = renderTrendMarkdown(trend);
    expect(markdown).toContain("No trend data available");
  });

  it("renders score trend header", () => {
    const entries = [
      { timestamp: "2024-01-01T00:00:00Z", overall_score: 80, grade: "B" as const, total_findings: 5, domain_scores: {} },
    ];
    const trend = analyzeTrend(entries);
    const markdown = renderTrendMarkdown(trend);
    expect(markdown).toContain("## Score Trend");
  });

  it("includes direction indicator", () => {
    const entries = [
      { timestamp: "2024-01-01T00:00:00Z", overall_score: 70, grade: "C" as const, total_findings: 8, domain_scores: {} },
      { timestamp: "2024-02-01T00:00:00Z", overall_score: 80, grade: "B" as const, total_findings: 5, domain_scores: {} },
      { timestamp: "2024-03-01T00:00:00Z", overall_score: 90, grade: "A" as const, total_findings: 2, domain_scores: {} },
    ];
    const trend = analyzeTrend(entries);
    const markdown = renderTrendMarkdown(trend);
    expect(markdown).toContain("Improving");
  });

  it("includes metric table", () => {
    const entries = [
      { timestamp: "2024-01-01T00:00:00Z", overall_score: 80, grade: "B" as const, total_findings: 5, domain_scores: {} },
    ];
    const trend = analyzeTrend(entries);
    const markdown = renderTrendMarkdown(trend);
    expect(markdown).toContain("| Metric | Value |");
    expect(markdown).toContain("| Direction |");
  });

  it("renders statistics", () => {
    const entries = [
      { timestamp: "2024-01-01T00:00:00Z", overall_score: 70, grade: "C" as const, total_findings: 8, domain_scores: {} },
      { timestamp: "2024-03-01T00:00:00Z", overall_score: 90, grade: "A" as const, total_findings: 2, domain_scores: {} },
    ];
    const trend = analyzeTrend(entries);
    const markdown = renderTrendMarkdown(trend);
    expect(markdown).toContain("90"); // best score
    expect(markdown).toContain("70"); // worst score
  });
});
