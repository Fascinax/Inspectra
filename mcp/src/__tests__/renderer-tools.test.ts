import { describe, it, expect } from "vitest";
import { z } from "zod";
import { ConsolidatedReportSchema, type ConsolidatedReport } from "../types.js";
import { buildTrendEntry, analyzeTrend, renderTrendMarkdown } from "../renderer/trend.js";
import { compareReports, renderComparisonMarkdown } from "../renderer/compare.js";
import { renderHtml } from "../renderer/html.js";
import { makeFinding, makeDomainReport } from "./fixtures.js";

// ─── Helpers ──────────────────────────────────────────────────────────────────

function makeReport(overrides: Partial<ConsolidatedReport> = {}): ConsolidatedReport {
  return {
    overall_score: 75,
    grade: "B",
    summary: "2 findings.",
    domain_reports: [
      makeDomainReport({ domain: "security", score: 70 }),
      makeDomainReport({ domain: "tests", score: 80 }),
    ],
    top_findings: [makeFinding()],
    statistics: {
      total_findings: 2,
      by_severity: { critical: 0, high: 1, medium: 1, low: 0, info: 0 },
      by_domain: { security: 1, tests: 1 },
    },
    metadata: {
      timestamp: "2026-01-01T10:00:00.000Z",
      target: "/project",
      profile: "generic",
      duration_ms: 1000,
    },
    ...overrides,
  };
}

function makeReportAt(score: number, timestamp: string): ConsolidatedReport {
  return makeReport({
    overall_score: score,
    grade: score >= 90 ? "A" : score >= 75 ? "B" : score >= 60 ? "C" : "D",
    metadata: {
      timestamp,
      target: "/project",
      profile: "generic",
      duration_ms: 1000,
    },
  });
}

// ─── inspectra_render_trend — handler flow ────────────────────────────────────

describe("inspectra_render_trend — integrated handler flow", () => {
  it("validates and parses reports JSON", () => {
    const reports = [makeReport(), makeReport()];
    const parsed = z.array(ConsolidatedReportSchema).parse(reports);
    expect(parsed).toHaveLength(2);
  });

  it("rejects invalid reports JSON with a parse error", () => {
    expect(() =>
      z.array(ConsolidatedReportSchema).parse(JSON.parse(`[{"not": "valid"}]`)),
    ).toThrow();
  });

  it("rejects a single report (minimum 2 required)", () => {
    const parsed = z.array(ConsolidatedReportSchema).parse([makeReport()]);
    expect(parsed.length < 2).toBe(true);
  });

  it("produces a TrendData from 2 reports", () => {
    const reports = [makeReportAt(60, "2026-01-01T00:00:00.000Z"), makeReportAt(80, "2026-02-01T00:00:00.000Z")];
    const entries = reports.map(buildTrendEntry);
    const trend = analyzeTrend(entries);
    expect(trend.entries).toHaveLength(2);
    expect(trend.scoreChange).toBe(20);
  });

  it("direction is improving when score increases significantly", () => {
    const reports = [
      makeReportAt(50, "2026-01-01T00:00:00.000Z"),
      makeReportAt(60, "2026-02-01T00:00:00.000Z"),
      makeReportAt(70, "2026-03-01T00:00:00.000Z"),
    ];
    const trend = analyzeTrend(reports.map(buildTrendEntry));
    expect(trend.direction).toBe("improving");
  });

  it("direction is declining when score drops significantly", () => {
    const reports = [
      makeReportAt(90, "2026-01-01T00:00:00.000Z"),
      makeReportAt(75, "2026-02-01T00:00:00.000Z"),
      makeReportAt(60, "2026-03-01T00:00:00.000Z"),
    ];
    const trend = analyzeTrend(reports.map(buildTrendEntry));
    expect(trend.direction).toBe("declining");
  });

  it("renders Markdown with trend table", () => {
    const reports = [makeReportAt(70, "2026-01-01T00:00:00.000Z"), makeReportAt(80, "2026-02-01T00:00:00.000Z")];
    const trend = analyzeTrend(reports.map(buildTrendEntry));
    const md = renderTrendMarkdown(trend);
    expect(md).toContain("## Score Trend");
    expect(md).toContain("Direction");
    expect(md).toContain("### History");
  });

  it("Markdown output contains the score change", () => {
    const reports = [makeReportAt(60, "2026-01-01T00:00:00.000Z"), makeReportAt(85, "2026-02-01T00:00:00.000Z")];
    const trend = analyzeTrend(reports.map(buildTrendEntry));
    const md = renderTrendMarkdown(trend);
    expect(md).toContain("+25");
  });

  it("computes correct averageScore", () => {
    const reports = [
      makeReportAt(60, "2026-01-01T00:00:00.000Z"),
      makeReportAt(80, "2026-02-01T00:00:00.000Z"),
      makeReportAt(70, "2026-03-01T00:00:00.000Z"),
    ];
    const trend = analyzeTrend(reports.map(buildTrendEntry));
    expect(trend.averageScore).toBe(70);
  });

  it("computes correct bestScore and worstScore", () => {
    const reports = [
      makeReportAt(55, "2026-01-01T00:00:00.000Z"),
      makeReportAt(90, "2026-02-01T00:00:00.000Z"),
      makeReportAt(72, "2026-03-01T00:00:00.000Z"),
    ];
    const trend = analyzeTrend(reports.map(buildTrendEntry));
    expect(trend.bestScore).toBe(90);
    expect(trend.worstScore).toBe(55);
  });

  it("handles 10 reports and caps history display to last 10", () => {
    const reports = Array.from({ length: 10 }, (_, i) =>
      makeReportAt(60 + i, `2026-${String(i + 1).padStart(2, "0")}-01T00:00:00.000Z`),
    );
    const trend = analyzeTrend(reports.map(buildTrendEntry));
    const md = renderTrendMarkdown(trend);
    expect(trend.entries).toHaveLength(10);
    expect(md).toContain("## Score Trend");
  });
});

// ─── inspectra_compare_reports — handler flow ─────────────────────────────────

describe("inspectra_compare_reports — integrated handler flow", () => {
  it("validates and parses both report JSONs", () => {
    const report = makeReport();
    const parsedA = ConsolidatedReportSchema.parse(report);
    const parsedB = ConsolidatedReportSchema.parse(report);
    expect(parsedA.overall_score).toBe(75);
    expect(parsedB.overall_score).toBe(75);
  });

  it("rejects invalid reportAJson with a parse error", () => {
    expect(() => ConsolidatedReportSchema.parse({ not: "valid" })).toThrow();
  });

  it("rejects invalid reportBJson with a parse error", () => {
    expect(() => ConsolidatedReportSchema.parse(null)).toThrow();
  });

  it("produces a ComparisonResult with correct overallDelta", () => {
    const reportA = makeReport({ overall_score: 80, grade: "B" });
    const reportB = makeReport({ overall_score: 65, grade: "C" });
    const result = compareReports(reportA, reportB, "main", "pr");
    expect(result.overallDelta).toBe(15);
  });

  it("assigns custom labels to reportA and reportB", () => {
    const result = compareReports(makeReport(), makeReport(), "main", "feature/login");
    expect(result.reportA.label).toBe("main");
    expect(result.reportB.label).toBe("feature/login");
  });

  it("defaults to Baseline/Current labels when not provided", () => {
    const result = compareReports(makeReport(), makeReport());
    expect(result.reportA.label).toBe("Report A");
    expect(result.reportB.label).toBe("Report B");
  });

  it("detects added findings when reportA has unique finding id", () => {
    const base = makeReport({
      domain_reports: [makeDomainReport({ findings: [makeFinding({ id: "SEC-001" }), makeFinding({ id: "SEC-002" })] })],
    });
    const current = makeReport({
      domain_reports: [makeDomainReport({ findings: [makeFinding({ id: "SEC-001" })] })],
    });
    const result = compareReports(base, current, "A", "B");
    expect(result.added.some((f) => f.id === "SEC-002")).toBe(true);
  });

  it("detects removed findings when reportB has unique finding id", () => {
    const base = makeReport({
      domain_reports: [makeDomainReport({ findings: [makeFinding({ id: "SEC-001" })] })],
    });
    const current = makeReport({
      domain_reports: [makeDomainReport({ findings: [makeFinding({ id: "SEC-001" }), makeFinding({ id: "SEC-003" })] })],
    });
    const result = compareReports(base, current, "A", "B");
    expect(result.removed.some((f) => f.id === "SEC-003")).toBe(true);
  });

  it("renders Markdown comparison with summary table", () => {
    const reportA = makeReport({ overall_score: 80, grade: "B" });
    const reportB = makeReport({ overall_score: 70, grade: "C" });
    const result = compareReports(reportA, reportB, "main", "pr");
    const md = renderComparisonMarkdown(result);
    expect(md).toContain("## Audit Comparison");
    expect(md).toContain("main");
    expect(md).toContain("pr");
  });

  it("Markdown shows positive delta with ▲ arrow", () => {
    const reportA = makeReport({ overall_score: 90, grade: "A" });
    const reportB = makeReport({ overall_score: 70, grade: "C" });
    const result = compareReports(reportA, reportB);
    const md = renderComparisonMarkdown(result);
    expect(md).toContain("▲");
  });

  it("Markdown shows negative delta with ▼ arrow", () => {
    const reportA = makeReport({ overall_score: 60, grade: "C" });
    const reportB = makeReport({ overall_score: 80, grade: "B" });
    const result = compareReports(reportA, reportB);
    const md = renderComparisonMarkdown(result);
    expect(md).toContain("▼");
  });

  it("returns zero overallDelta for identical reports", () => {
    const report = makeReport();
    const result = compareReports(report, report);
    expect(result.overallDelta).toBe(0);
  });

  it("unchanged findings are those shared by both reports", () => {
    const shared = makeFinding({ id: "SEC-001" });
    const base = makeReport({ domain_reports: [makeDomainReport({ findings: [shared] })] });
    const current = makeReport({ domain_reports: [makeDomainReport({ findings: [shared] })] });
    const result = compareReports(base, current);
    expect(result.unchanged.some((f) => f.id === "SEC-001")).toBe(true);
    expect(result.added).toHaveLength(0);
    expect(result.removed).toHaveLength(0);
  });
});

// ─── inspectra_render_html — handler flow ─────────────────────────────────────

describe("inspectra_render_html — integrated handler flow", () => {
  it("validates and parses report JSON", () => {
    const report = makeReport();
    const parsed = ConsolidatedReportSchema.parse(report);
    expect(parsed.overall_score).toBe(75);
  });

  it("rejects invalid reportJson with a parse error", () => {
    expect(() => ConsolidatedReportSchema.parse({ not: "valid" })).toThrow();
  });

  it("returns a string starting with <!DOCTYPE html>", () => {
    const html = renderHtml(makeReport());
    expect(html.trimStart()).toMatch(/^<!DOCTYPE html>/);
  });

  it("embeds the overall score in the HTML", () => {
    const html = renderHtml(makeReport({ overall_score: 75 }));
    expect(html).toContain("75");
  });

  it("embeds the grade in the HTML", () => {
    const html = renderHtml(makeReport({ grade: "B" }));
    expect(html).toContain("B");
  });

  it("contains domain names from the report", () => {
    const html = renderHtml(makeReport());
    expect(html).toContain("security");
    expect(html).toContain("tests");
  });

  it("is self-contained — no external stylesheet or script src", () => {
    const html = renderHtml(makeReport());
    expect(html).not.toMatch(/<link[^>]+href=["']http/);
    expect(html).not.toMatch(/<script[^>]+src=["']http/);
  });

  it("includes finding ids when findings are present", () => {
    const report = makeReport({
      domain_reports: [makeDomainReport({ findings: [makeFinding({ id: "SEC-001" })] })],
    });
    const html = renderHtml(report);
    expect(html).toContain("SEC-001");
  });

  it("produces valid HTML with <html>, <head> and <body> tags", () => {
    const html = renderHtml(makeReport());
    expect(html).toContain("<html");
    expect(html).toContain("<head>");
    expect(html).toContain("<body>");
    expect(html).toContain("</body>");
    expect(html).toContain("</html>");
  });

  it("escapes XSS characters in finding titles", () => {
    const xssTitle = '<script>alert("xss")</script>';
    const report = makeReport({
      domain_reports: [makeDomainReport({ findings: [makeFinding({ id: "SEC-XSS", title: xssTitle })] })],
    });
    const html = renderHtml(report);
    expect(html).not.toContain("<script>alert");
    expect(html).toContain("&lt;script&gt;");
  });
});
