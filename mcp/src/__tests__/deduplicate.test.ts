import { describe, it, expect } from "vitest";
import { deduplicateFindings } from "../merger/deduplicate.js";
import { makeFinding } from "./fixtures.js";
import type { DeduplicationConfig } from "../policies/loader.js";

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
    // same key: rule-a::no-file:0 — keep higher confidence
    const result = deduplicateFindings([a, b]);
    expect(result).toHaveLength(1);
    expect(result[0].confidence).toBe(0.9); // a has 0.9 (default fixture), b has 0.8
  });

  describe("strategy: same-rule-same-file", () => {
    it("merges findings with same rule and file but different lines", () => {
      const config: DeduplicationConfig = {
        strategy: "same-rule-same-file",
        cross_domain_aliases: [],
      };
      const findings = [
        makeFinding({ rule: "no-todos", evidence: [{ file: "a.ts", line: 10 }], confidence: 0.7 }),
        makeFinding({ rule: "no-todos", evidence: [{ file: "a.ts", line: 20 }], confidence: 0.9 }),
      ];
      const result = deduplicateFindings(findings, config);
      expect(result).toHaveLength(1);
      expect(result[0].confidence).toBe(0.9);
    });

    it("keeps findings in different files separate", () => {
      const config: DeduplicationConfig = {
        strategy: "same-rule-same-file",
        cross_domain_aliases: [],
      };
      const findings = [
        makeFinding({ rule: "no-todos", evidence: [{ file: "a.ts", line: 10 }] }),
        makeFinding({ rule: "no-todos", evidence: [{ file: "b.ts", line: 10 }] }),
      ];
      const result = deduplicateFindings(findings, config);
      expect(result).toHaveLength(2);
    });
  });

  describe("strategy: same-rule-any-location", () => {
    it("merges all findings with the same rule regardless of location", () => {
      const config: DeduplicationConfig = {
        strategy: "same-rule-any-location",
        cross_domain_aliases: [],
      };
      const findings = [
        makeFinding({ rule: "no-todos", evidence: [{ file: "a.ts", line: 10 }], confidence: 0.6 }),
        makeFinding({ rule: "no-todos", evidence: [{ file: "b.ts", line: 20 }], confidence: 0.9 }),
      ];
      const result = deduplicateFindings(findings, config);
      expect(result).toHaveLength(1);
      expect(result[0].confidence).toBe(0.9);
    });
  });

  describe("on_conflict: keep highest severity", () => {
    it("prefers higher severity over higher confidence", () => {
      const config: DeduplicationConfig = {
        strategy: "same-rule-same-location",
        cross_domain_aliases: [],
        on_conflict: "keep highest severity",
      };
      const highConfLow = makeFinding({ rule: "rule-x", severity: "low", confidence: 1.0, evidence: [{ file: "a.ts", line: 1 }] });
      const lowConfCrit = makeFinding({ rule: "rule-x", severity: "critical", confidence: 0.5, evidence: [{ file: "a.ts", line: 1 }] });
      const result = deduplicateFindings([highConfLow, lowConfCrit], config);
      expect(result).toHaveLength(1);
      expect(result[0].severity).toBe("critical");
    });

    it("falls back to confidence when severity is equal", () => {
      const config: DeduplicationConfig = {
        strategy: "same-rule-same-location",
        cross_domain_aliases: [],
        on_conflict: "keep highest severity",
      };
      const low = makeFinding({ rule: "rule-x", severity: "high", confidence: 0.4, evidence: [{ file: "a.ts", line: 1 }] });
      const high = makeFinding({ rule: "rule-x", severity: "high", confidence: 0.9, evidence: [{ file: "a.ts", line: 1 }] });
      const result = deduplicateFindings([low, high], config);
      expect(result[0].confidence).toBe(0.9);
    });
  });
});
