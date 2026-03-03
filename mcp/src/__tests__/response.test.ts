import { describe, it, expect } from "vitest";
import { jsonResponse, findingsResponse, reportResponse } from "../register/response.js";
import { makeFinding, makeDomainReport } from "./fixtures.js";
import { CHARACTER_LIMIT } from "../constants.js";
import type { ConsolidatedReport } from "../types.js";

describe("jsonResponse", () => {
  it("returns structuredContent alongside text content", () => {
    const data = [makeFinding()];
    const result = jsonResponse(data);

    expect(result.content).toHaveLength(1);
    expect(result.content[0].type).toBe("text");
    expect(result.structuredContent).toEqual(data);
  });

  it("returns valid JSON when data fits within CHARACTER_LIMIT", () => {
    const findings = [makeFinding(), makeFinding({ id: "SEC-002" })];
    const result = jsonResponse(findings);

    const text = (result.content[0] as { type: "text"; text: string }).text;
    expect(() => JSON.parse(text)).not.toThrow();
    expect(JSON.parse(text)).toEqual(findings);
  });

  it("truncates large arrays while producing valid JSON", () => {
    const largeFindings = Array.from({ length: 5000 }, (_, i) =>
      makeFinding({
        id: `SEC-${String(i).padStart(4, "0")}`,
        description: "A".repeat(200),
      }),
    );

    const result = jsonResponse(largeFindings);
    const text = (result.content[0] as { type: "text"; text: string }).text;

    expect(() => JSON.parse(text)).not.toThrow();
    expect(text.length).toBeLessThanOrEqual(CHARACTER_LIMIT);

    const parsed = JSON.parse(text) as Record<string, unknown>;
    expect(parsed.truncated).toBe(true);
    expect(parsed.total_count).toBe(5000);
    expect(typeof parsed.returned_count).toBe("number");
    expect((parsed.returned_count as number)).toBeLessThan(5000);
    expect(typeof parsed.truncation_message).toBe("string");
    expect(Array.isArray(parsed.findings)).toBe(true);
  });

  it("truncates object with findings array while preserving other fields", () => {
    const report = {
      domain: "security",
      score: 42,
      findings: Array.from({ length: 5000 }, (_, i) =>
        makeFinding({
          id: `SEC-${String(i).padStart(4, "0")}`,
          description: "B".repeat(200),
        }),
      ),
    };

    const result = jsonResponse(report);
    const text = (result.content[0] as { type: "text"; text: string }).text;
    const parsed = JSON.parse(text) as Record<string, unknown>;

    expect(parsed.domain).toBe("security");
    expect(parsed.score).toBe(42);
    expect(parsed.truncated).toBe(true);
    expect((parsed.findings as unknown[]).length).toBeLessThan(5000);
  });

  it("returns error metadata when non-array data exceeds limit", () => {
    const huge = { payload: "X".repeat(CHARACTER_LIMIT + 1000) };
    const result = jsonResponse(huge);
    const text = (result.content[0] as { type: "text"; text: string }).text;
    const parsed = JSON.parse(text) as Record<string, unknown>;

    expect(parsed.error).toBe("Response too large to serialize");
    expect(parsed.character_limit).toBe(CHARACTER_LIMIT);
  });
});

describe("findingsResponse", () => {
  it("defaults to JSON format with pagination envelope", () => {
    const findings = [makeFinding()];
    const result = findingsResponse(findings);

    const text = (result.content[0] as { type: "text"; text: string }).text;
    const parsed = JSON.parse(text);
    expect(parsed.findings).toEqual(findings);
    expect(parsed.total).toBe(1);
    expect(parsed.count).toBe(1);
    expect(parsed.has_more).toBe(false);
    expect(parsed.next_offset).toBeNull();
    expect(result.structuredContent).toEqual({
      findings,
      total: 1,
      count: 1,
      has_more: false,
      next_offset: null,
    });
  });

  it("returns markdown text when format is markdown", () => {
    const findings = [makeFinding(), makeFinding({ id: "SEC-002", severity: "critical" })];
    const result = findingsResponse(findings, "markdown");

    const text = (result.content[0] as { type: "text"; text: string }).text;
    expect(text).toContain("**2 finding(s)**");
    expect(text).toContain("SEC-001");
    expect(text).toContain("SEC-002");
    expect(text).toContain("Critical");
    expect(text).not.toContain("[{");
  });

  it("keeps structuredContent as paginated envelope even in markdown mode", () => {
    const findings = [makeFinding()];
    const result = findingsResponse(findings, "markdown");

    expect(result.structuredContent).toEqual({
      findings,
      total: 1,
      count: 1,
      has_more: false,
      next_offset: null,
    });
  });

  it("paginates findings with limit and offset", () => {
    const findings = Array.from({ length: 5 }, (_, i) => makeFinding({ id: `SEC-${String(i + 1).padStart(3, "0")}` }));
    const result = findingsResponse(findings, "json", { limit: 2, offset: 1 });

    const parsed = JSON.parse((result.content[0] as { type: "text"; text: string }).text);
    expect(parsed.findings).toHaveLength(2);
    expect(parsed.findings[0].id).toBe("SEC-002");
    expect(parsed.findings[1].id).toBe("SEC-003");
    expect(parsed.total).toBe(5);
    expect(parsed.count).toBe(2);
    expect(parsed.has_more).toBe(true);
    expect(parsed.next_offset).toBe(3);
  });

  it("returns no-findings message for empty array in markdown mode", () => {
    const result = findingsResponse([], "markdown");
    const text = (result.content[0] as { type: "text"; text: string }).text;
    expect(text).toBe("No findings detected.");
  });
});

describe("reportResponse", () => {
  it("returns JSON by default", () => {
    const report: ConsolidatedReport = {
      overall_score: 85,
      grade: "B",
      summary: "Good overall quality.",
      domain_reports: [makeDomainReport()],
      top_findings: [makeFinding()],
      metadata: {
        timestamp: "2026-02-27T10:00:00.000Z",
        target: "test-repo",
        profile: "generic",
      },
    };

    const result = reportResponse(report);
    const text = (result.content[0] as { type: "text"; text: string }).text;
    expect(() => JSON.parse(text)).not.toThrow();
  });

  it("returns full markdown report when format is markdown", () => {
    const report: ConsolidatedReport = {
      overall_score: 85,
      grade: "B",
      summary: "Good overall quality.",
      domain_reports: [makeDomainReport()],
      top_findings: [makeFinding()],
      metadata: {
        timestamp: "2026-02-27T10:00:00.000Z",
        target: "test-repo",
        profile: "generic",
      },
    };

    const result = reportResponse(report, "markdown");
    const text = (result.content[0] as { type: "text"; text: string }).text;
    expect(text).toContain("# Inspectra Audit Report");
    expect(text).toContain("Executive Summary");
    expect(text).toContain("85/100");
    expect(result.structuredContent).toEqual(report);
  });
});
