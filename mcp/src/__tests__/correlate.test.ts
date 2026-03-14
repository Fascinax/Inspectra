import { describe, it, expect } from "vitest";
import type { Finding } from "../types.js";
import { detectHotspots } from "../merger/correlate.js";

function makeFinding(overrides: Partial<Finding> & { file: string; rule: string; domain: Finding["domain"] }): Finding {
  return {
    id: "SEC-001",
    severity: "medium",
    title: "Test finding",
    domain: overrides.domain,
    rule: overrides.rule,
    confidence: 0.9,
    source: "tool",
    evidence: [{ file: overrides.file }],
    ...overrides,
  };
}

describe("detectHotspots", () => {
  it("returns empty result for empty findings", () => {
    const result = detectHotspots([]);
    expect(result.total).toBe(0);
    expect(result.hotspots).toHaveLength(0);
    expect(result.metadata.input_findings).toBe(0);
  });

  describe("file hotspots", () => {
    it("detects file hotspot with 3+ findings from 2+ domains", () => {
      const findings: Finding[] = [
        makeFinding({ file: "src/auth.ts", rule: "hardcoded-secret", domain: "security" }),
        makeFinding({ file: "src/auth.ts", rule: "function-too-long", domain: "conventions" }),
        makeFinding({ file: "src/auth.ts", rule: "missing-test-file", domain: "tests" }),
      ];
      const result = detectHotspots(findings);
      const hotspot = result.hotspots.find((h) => h.type === "file");
      expect(hotspot).toBeDefined();
      expect(hotspot?.key).toBe("src/auth.ts");
      expect(hotspot?.finding_count).toBe(3);
      expect(hotspot?.domain_count).toBe(3);
      expect(result.metadata.file_hotspots).toBe(1);
    });

    it("does NOT flag file with 3+ findings but only 1 domain", () => {
      const findings: Finding[] = [
        makeFinding({ file: "src/auth.ts", rule: "rule-a", domain: "security" }),
        makeFinding({ file: "src/auth.ts", rule: "rule-b", domain: "security" }),
        makeFinding({ file: "src/auth.ts", rule: "rule-c", domain: "security" }),
      ];
      const result = detectHotspots(findings);
      expect(result.hotspots.filter((h) => h.type === "file")).toHaveLength(0);
    });

    it("does NOT flag file with only 2 findings even from 2 domains", () => {
      const findings: Finding[] = [
        makeFinding({ file: "src/small.ts", rule: "rule-a", domain: "security" }),
        makeFinding({ file: "src/small.ts", rule: "rule-b", domain: "tests" }),
      ];
      const result = detectHotspots(findings);
      expect(result.hotspots.filter((h) => h.type === "file")).toHaveLength(0);
    });

    it("uses severity ceiling of the most severe finding in the hotspot", () => {
      const findings: Finding[] = [
        makeFinding({ file: "src/auth.ts", rule: "rule-a", domain: "security", severity: "info" }),
        makeFinding({ file: "src/auth.ts", rule: "rule-b", domain: "tests", severity: "critical" }),
        makeFinding({ file: "src/auth.ts", rule: "rule-c", domain: "conventions", severity: "medium" }),
      ];
      const result = detectHotspots(findings);
      const hotspot = result.hotspots.find((h) => h.type === "file");
      expect(hotspot?.severity_ceiling).toBe("critical");
    });
  });

  describe("module hotspots", () => {
    it("detects module hotspot with 5+ findings across 2+ files in the same directory", () => {
      const findings: Finding[] = [
        makeFinding({ file: "src/services/user.ts", rule: "rule-a", domain: "security" }),
        makeFinding({ file: "src/services/user.ts", rule: "rule-b", domain: "tests" }),
        makeFinding({ file: "src/services/order.ts", rule: "rule-c", domain: "conventions" }),
        makeFinding({ file: "src/services/order.ts", rule: "rule-d", domain: "tech-debt" }),
        makeFinding({ file: "src/services/payment.ts", rule: "rule-e", domain: "security" }),
      ];
      const result = detectHotspots(findings);
      const hotspot = result.hotspots.find((h) => h.type === "module");
      expect(hotspot).toBeDefined();
      expect(hotspot?.key).toBe("src/services");
      expect(hotspot?.finding_count).toBe(5);
    });

    it("does NOT flag module with 5+ findings in a single file", () => {
      const findings: Finding[] = Array.from({ length: 5 }, (_, i) =>
        makeFinding({ file: "src/services/only.ts", rule: `rule-${i}`, domain: "security" }),
      );
      const result = detectHotspots(findings);
      expect(result.hotspots.filter((h) => h.type === "module")).toHaveLength(0);
    });

    it("does NOT flag module with only 4 findings across 2 files", () => {
      const findings: Finding[] = [
        makeFinding({ file: "src/lib/a.ts", rule: "rule-a", domain: "security" }),
        makeFinding({ file: "src/lib/a.ts", rule: "rule-b", domain: "tests" }),
        makeFinding({ file: "src/lib/b.ts", rule: "rule-c", domain: "conventions" }),
        makeFinding({ file: "src/lib/b.ts", rule: "rule-d", domain: "tech-debt" }),
      ];
      const result = detectHotspots(findings);
      expect(result.hotspots.filter((h) => h.type === "module")).toHaveLength(0);
    });
  });

  describe("dependency hotspots", () => {
    it("detects dependency hotspot: 2+ findings from 2+ domains on package.json", () => {
      const findings: Finding[] = [
        makeFinding({ file: "package.json", rule: "outdated-dep", domain: "tech-debt" }),
        makeFinding({ file: "package.json", rule: "vulnerable-dep", domain: "security" }),
      ];
      const result = detectHotspots(findings);
      const hotspot = result.hotspots.find((h) => h.type === "dependency");
      expect(hotspot).toBeDefined();
      expect(hotspot?.key).toBe("package.json");
      expect(result.metadata.dependency_hotspots).toBe(1);
    });

    it("detects dependency hotspot on pom.xml", () => {
      const findings: Finding[] = [
        makeFinding({ file: "pom.xml", rule: "outdated-dep", domain: "tech-debt" }),
        makeFinding({ file: "pom.xml", rule: "vulnerable-dep", domain: "security" }),
      ];
      const result = detectHotspots(findings);
      expect(result.hotspots.filter((h) => h.type === "dependency")).toHaveLength(1);
    });

    it("does NOT flag package.json with 2 findings from the same domain", () => {
      const findings: Finding[] = [
        makeFinding({ file: "package.json", rule: "rule-a", domain: "security" }),
        makeFinding({ file: "package.json", rule: "rule-b", domain: "security" }),
      ];
      const result = detectHotspots(findings);
      expect(result.hotspots.filter((h) => h.type === "dependency")).toHaveLength(0);
    });

    it("does NOT flag a regular source file as a dependency hotspot", () => {
      const findings: Finding[] = [
        makeFinding({ file: "src/config.ts", rule: "rule-a", domain: "security" }),
        makeFinding({ file: "src/config.ts", rule: "rule-b", domain: "tests" }),
      ];
      const result = detectHotspots(findings);
      expect(result.hotspots.filter((h) => h.type === "dependency")).toHaveLength(0);
    });
  });

  describe("pattern hotspots", () => {
    it("detects pattern hotspot: same rule ≥5 times across ≥2 files", () => {
      const findings: Finding[] = [
        makeFinding({ file: "src/a.ts", rule: "function-too-long", domain: "conventions" }),
        makeFinding({ file: "src/b.ts", rule: "function-too-long", domain: "conventions" }),
        makeFinding({ file: "src/c.ts", rule: "function-too-long", domain: "conventions" }),
        makeFinding({ file: "src/d.ts", rule: "function-too-long", domain: "conventions" }),
        makeFinding({ file: "src/e.ts", rule: "function-too-long", domain: "conventions" }),
      ];
      const result = detectHotspots(findings);
      const hotspot = result.hotspots.find((h) => h.type === "pattern");
      expect(hotspot).toBeDefined();
      expect(hotspot?.key).toBe("function-too-long");
      expect(hotspot?.finding_count).toBe(5);
      expect(hotspot?.label).toContain("5×");
      expect(result.metadata.pattern_hotspots).toBe(1);
    });

    it("does NOT flag rule that fires 5+ times but only in 1 file", () => {
      const findings: Finding[] = Array.from({ length: 5 }, () =>
        makeFinding({ file: "src/single.ts", rule: "function-too-long", domain: "conventions" }),
      );
      const result = detectHotspots(findings);
      expect(result.hotspots.filter((h) => h.type === "pattern")).toHaveLength(0);
    });

    it("does NOT flag rule that fires in 2 files but only 4 times total", () => {
      const findings: Finding[] = [
        makeFinding({ file: "src/a.ts", rule: "magic-number", domain: "conventions" }),
        makeFinding({ file: "src/a.ts", rule: "magic-number", domain: "conventions" }),
        makeFinding({ file: "src/b.ts", rule: "magic-number", domain: "conventions" }),
        makeFinding({ file: "src/b.ts", rule: "magic-number", domain: "conventions" }),
      ];
      const result = detectHotspots(findings);
      expect(result.hotspots.filter((h) => h.type === "pattern")).toHaveLength(0);
    });
  });

  describe("sorting", () => {
    it("sorts hotspots by severity_ceiling descending, then finding_count descending", () => {
      const findings: Finding[] = [
        // Pattern hotspot (low severity, 5 findings)
        makeFinding({ file: "src/a.ts", rule: "todo-found", domain: "conventions", severity: "low" }),
        makeFinding({ file: "src/b.ts", rule: "todo-found", domain: "conventions", severity: "low" }),
        makeFinding({ file: "src/c.ts", rule: "todo-found", domain: "conventions", severity: "low" }),
        makeFinding({ file: "src/d.ts", rule: "todo-found", domain: "conventions", severity: "low" }),
        makeFinding({ file: "src/e.ts", rule: "todo-found", domain: "conventions", severity: "low" }),
        // File hotspot (critical + medium + info, 3 findings, 2 domains)
        makeFinding({ file: "src/auth.ts", rule: "rule-x", domain: "security", severity: "critical" }),
        makeFinding({ file: "src/auth.ts", rule: "rule-y", domain: "tests", severity: "medium" }),
        makeFinding({ file: "src/auth.ts", rule: "rule-z", domain: "tests", severity: "info" }),
      ];
      const result = detectHotspots(findings);
      expect(result.hotspots.length).toBeGreaterThan(0);
      // The critical file hotspot should come first
      expect(result.hotspots[0].severity_ceiling).toBe("critical");
    });
  });

  describe("metadata", () => {
    it("reports correct input_findings count", () => {
      const findings = Array.from({ length: 7 }, (_, i) =>
        makeFinding({ file: `src/file${i}.ts`, rule: "rule", domain: "security" }),
      );
      const result = detectHotspots(findings);
      expect(result.metadata.input_findings).toBe(7);
    });
  });
});
