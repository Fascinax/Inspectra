import { describe, it, expect } from "vitest";
import { buildSummary, applyConfidenceAdjustments, matchesCondition } from "../merger/merge-helpers.js";
import { makeFinding, makeDomainReport } from "./fixtures.js";

describe("buildSummary", () => {
  it("includes score, grade, and severity breakdown", () => {
    const bySeverity = { critical: 0, high: 2, medium: 1, low: 0, info: 0 };
    const result = buildSummary(75, bySeverity, []);
    expect(result).toContain("75/100");
    expect(result).toContain("Grade B");
    expect(result).toContain("2 high");
    expect(result).toContain("1 medium");
  });

  it("reports priority area when a domain scores below 70", () => {
    const reports = [
      makeDomainReport({ domain: "security", score: 40 }),
      makeDomainReport({ domain: "tests", score: 90 }),
    ];
    const bySeverity = { critical: 0, high: 0, medium: 0, low: 0, info: 0 };
    const result = buildSummary(65, bySeverity, reports);
    expect(result).toContain("Priority area: security");
  });

  it("omits priority area when all domains score 70+", () => {
    const reports = [makeDomainReport({ domain: "security", score: 85 })];
    const bySeverity = { critical: 0, high: 0, medium: 0, low: 0, info: 0 };
    const result = buildSummary(85, bySeverity, reports);
    expect(result).not.toContain("Priority area");
  });

  it("appends SLA info when severityMatrix is provided", () => {
    const bySeverity = { critical: 1, high: 0, medium: 0, low: 0, info: 0 };
    const matrix = {
      severity_defaults: {
        critical: { description: "Must fix immediately", sla_days: 1 },
        high: { description: "Fix within a week", sla_days: 7 },
        medium: { description: "Fix within a month", sla_days: 30 },
      },
    };
    const result = buildSummary(50, bySeverity, [], undefined, matrix);
    expect(result).toContain("Fix SLA:");
    expect(result).toContain("critical ≤1d");
  });
});

describe("applyConfidenceAdjustments", () => {
  it("returns findings unchanged when no adjustments", () => {
    const findings = [makeFinding({ confidence: 0.9 })];
    const result = applyConfidenceAdjustments(findings, []);
    expect(result).toEqual(findings);
  });

  it("adjusts confidence based on matching conditions", () => {
    const findings = [
      makeFinding({ confidence: 0.8, evidence: [{ file: "src/config.ts", snippet: "const x = 1" }] }),
    ];
    const adjustments = [{ condition: "evidence_has_snippet", description: "boost snippet evidence", delta: 0.1 }];
    const result = applyConfidenceAdjustments(findings, adjustments);
    expect(result[0].confidence).toBeCloseTo(0.9);
  });

  it("clamps confidence between 0 and 1", () => {
    const findings = [makeFinding({ confidence: 0.95, evidence: [{ file: "a.ts", snippet: "x" }] })];
    const adjustments = [{ condition: "evidence_has_snippet", description: "boost snippet evidence", delta: 0.2 }];
    const result = applyConfidenceAdjustments(findings, adjustments);
    expect(result[0].confidence).toBe(1);
  });
});

describe("matchesCondition", () => {
  it("matches evidence_has_snippet when snippet is present", () => {
    const finding = makeFinding({ evidence: [{ file: "a.ts", snippet: "some code" }] });
    expect(matchesCondition(finding, "evidence_has_snippet")).toBe(true);
  });

  it("rejects evidence_has_snippet when no snippet", () => {
    const finding = makeFinding({ evidence: [{ file: "a.ts" }] });
    expect(matchesCondition(finding, "evidence_has_snippet")).toBe(false);
  });

  it("matches multiple_evidence_locations with 2+ locations", () => {
    const finding = makeFinding({ evidence: [{ file: "a.ts" }, { file: "b.ts" }] });
    expect(matchesCondition(finding, "multiple_evidence_locations")).toBe(true);
  });

  it("matches evidence_in_generated_code for vendor paths", () => {
    const finding = makeFinding({ evidence: [{ file: "dist/bundle.js" }] });
    expect(matchesCondition(finding, "evidence_in_generated_code")).toBe(true);
  });

  it("matches evidence_in_test_fixtures for fixture paths", () => {
    const finding = makeFinding({ evidence: [{ file: "__tests__/mock-data.ts" }] });
    expect(matchesCondition(finding, "evidence_in_test_fixtures")).toBe(true);
  });

  it("returns false for unknown conditions", () => {
    const finding = makeFinding();
    expect(matchesCondition(finding, "nonexistent_condition")).toBe(false);
  });
});
