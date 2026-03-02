import { describe, it, expect } from "vitest";
import { scoreDomain, computeOverallScore, deriveGrade } from "../merger/score.js";
import { makeFinding, makeDomainReport } from "./fixtures.js";

describe("scoreDomain", () => {
  it("returns 100 when there are no findings", () => {
    expect(scoreDomain([])).toBe(100);
  });

  it("subtracts penalty for a single high-confidence critical finding", () => {
    const finding = makeFinding({ severity: "critical", confidence: 1.0 });
    // penalty = 25 * 1.0 = 25 → score = 75
    expect(scoreDomain([finding])).toBe(75);
  });

  it("scales penalty by confidence", () => {
    const finding = makeFinding({ severity: "critical", confidence: 0.5 });
    // penalty = 25 * 0.5 = 12.5 → score = 88 (rounded)
    expect(scoreDomain([finding])).toBe(88);
  });

  it("accumulates penalties from multiple findings", () => {
    const findings = [
      makeFinding({ id: "SEC-001", severity: "high", confidence: 1.0 }), // -15
      makeFinding({ id: "SEC-002", severity: "medium", confidence: 1.0 }), // -8
    ];
    // score = 100 - 23 = 77
    expect(scoreDomain(findings)).toBe(77);
  });

  it("info findings have zero penalty", () => {
    const finding = makeFinding({ severity: "info", confidence: 1.0 });
    expect(scoreDomain([finding])).toBe(100);
  });

  it("never returns below 0", () => {
    const findings = Array.from({ length: 10 }, (_, i) =>
      makeFinding({ id: `SEC-00${i}`, severity: "critical", confidence: 1.0 }),
    );
    expect(scoreDomain(findings)).toBe(0);
  });
});

describe("computeOverallScore", () => {
  it("returns 0 for empty reports", () => {
    expect(computeOverallScore([])).toBe(0);
  });

  it("returns weighted average of domain scores", () => {
    const reports = [
      makeDomainReport({ domain: "security", score: 100 }),
      makeDomainReport({ domain: "tests", score: 100 }),
    ];
    expect(computeOverallScore(reports)).toBe(100);
  });

  it("security domain has higher weight than conventions", () => {
    const reports = [
      makeDomainReport({ domain: "security", score: 0 }),
      makeDomainReport({ domain: "conventions", score: 100 }),
    ];
    // security weight=0.30, conventions weight=0.15
    // (0*0.30 + 100*0.15) / 0.45 = 15/0.45 ≈ 33
    const score = computeOverallScore(reports);
    expect(score).toBeLessThan(50);
  });
});

describe("deriveGrade", () => {
  it.each([
    [100, "A"],
    [90, "A"],
    [89, "B"],
    [75, "B"],
    [74, "C"],
    [60, "C"],
    [59, "D"],
    [40, "D"],
    [39, "F"],
    [0, "F"],
  ])("score %i → grade %s", (score, grade) => {
    expect(deriveGrade(score)).toBe(grade);
  });

  it("uses custom grade thresholds from config", () => {
    const grades = {
      A: { min_score: 95, label: "Excellent", description: "" },
      B: { min_score: 80, label: "Good", description: "" },
      C: { min_score: 50, label: "OK", description: "" },
      F: { min_score: 0, label: "Fail", description: "" },
    };
    expect(deriveGrade(96, grades)).toBe("A");
    expect(deriveGrade(94, grades)).toBe("B");
    expect(deriveGrade(79, grades)).toBe("C");
    expect(deriveGrade(49, grades)).toBe("F");
  });

  it("returns F when score is below all custom thresholds", () => {
    const grades = {
      A: { min_score: 90, label: "A", description: "" },
      B: { min_score: 80, label: "B", description: "" },
    };
    expect(deriveGrade(79, grades)).toBe("F");
  });
});
