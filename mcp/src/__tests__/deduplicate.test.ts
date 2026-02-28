import { describe, it, expect } from "vitest";
import { deduplicateFindings } from "../merger/deduplicate.js";
import { makeFinding } from "./fixtures.js";

describe("deduplicateFindings", () => {
  it("returns empty array for no findings", () => {
    expect(deduplicateFindings([])).toEqual([]);
  });

  it("keeps unique findings untouched", () => {
    const findings = [
      makeFinding({ id: "SEC-001", rule: "no-hardcoded-secrets", evidence: [{ file: "a.ts", line: 1 }] }),
      makeFinding({ id: "SEC-002", rule: "no-hardcoded-secrets", evidence: [{ file: "b.ts", line: 1 }] }),
    ];
    expect(deduplicateFindings(findings)).toHaveLength(2);
  });

  it("deduplicates findings with the same rule and location", () => {
    const base = makeFinding({ rule: "no-hardcoded-secrets", evidence: [{ file: "a.ts", line: 5 }] });
    const duplicate = makeFinding({ rule: "no-hardcoded-secrets", evidence: [{ file: "a.ts", line: 5 }], confidence: 0.5 });
    const result = deduplicateFindings([base, duplicate]);
    expect(result).toHaveLength(1);
  });

  it("keeps the finding with higher confidence when deduplicating", () => {
    const lowConf = makeFinding({ id: "SEC-001", rule: "rule-x", evidence: [{ file: "x.ts", line: 1 }], confidence: 0.4 });
    const highConf = makeFinding({ id: "SEC-001", rule: "rule-x", evidence: [{ file: "x.ts", line: 1 }], confidence: 0.9 });
    const result = deduplicateFindings([lowConf, highConf]);
    expect(result[0].confidence).toBe(0.9);
  });

  it("treats same rule at different lines as distinct findings", () => {
    const findings = [
      makeFinding({ rule: "no-todos", evidence: [{ file: "a.ts", line: 10 }] }),
      makeFinding({ rule: "no-todos", evidence: [{ file: "a.ts", line: 20 }] }),
    ];
    expect(deduplicateFindings(findings)).toHaveLength(2);
  });

  it("handles findings without evidence using no-location key", () => {
    const a = makeFinding({ id: "SEC-001", rule: "rule-a", evidence: undefined });
    const b = makeFinding({ id: "SEC-002", rule: "rule-a", evidence: undefined, confidence: 0.8 });
    // same key: rule-a::no-location — keep higher confidence
    const result = deduplicateFindings([a, b]);
    expect(result).toHaveLength(1);
    expect(result[0].confidence).toBe(0.9); // a has 0.9 (default fixture), b has 0.8
  });
});
