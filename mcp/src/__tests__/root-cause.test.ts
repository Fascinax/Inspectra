import { describe, it, expect } from "vitest";
import { inferRootCauseClusters } from "../merger/root-cause.js";
import type { Hotspot } from "../merger/correlate.js";
import type { RootCausePattern } from "../policies/root-cause.js";
import { makeFinding } from "./fixtures.js";

function makeHotspot(overrides: Partial<Hotspot> = {}): Hotspot {
  const findings = overrides.findings ?? [
    makeFinding({ id: "SEC-001", domain: "security", rule: "hardcoded-secret", severity: "high" }),
  ];
  return {
    type: "file",
    key: "src/file.ts",
    label: "File hotspot",
    finding_count: findings.length,
    domain_count: new Set(findings.map((finding) => finding.domain)).size,
    domains: [...new Set(findings.map((finding) => finding.domain))],
    severity_ceiling: findings[0].severity,
    findings,
    ...overrides,
  };
}

describe("inferRootCauseClusters", () => {
  it("matches a deterministic category from hotspot type", () => {
    const patterns: RootCausePattern[] = [
      { category: "dependency-rot", hotspot_types: ["dependency"], confidence: 0.87 },
    ];

    const hotspot = makeHotspot({
      type: "dependency",
      key: "package.json",
      label: "Dependency hotspot",
      findings: [
        makeFinding({ id: "SEC-001", domain: "security", rule: "vulnerable-dep" }),
        makeFinding({ id: "DEBT-001", domain: "tech-debt", rule: "outdated-dep", severity: "medium" }),
      ],
      severity_ceiling: "high",
    });

    const result = inferRootCauseClusters([hotspot], patterns);
    expect(result.total).toBe(1);
    expect(result.clusters[0].category).toBe("dependency-rot");
    expect(result.clusters[0].source).toBe("tool");
    expect(result.metadata.matched_with_rules).toBe(1);
    expect(result.metadata.llm_fallback_count).toBe(0);
  });

  it("matches by any_rules and any_domains", () => {
    const patterns: RootCausePattern[] = [
      {
        category: "test-gap",
        any_rules: ["missing-test-file"],
        any_domains: ["tests"],
      },
    ];

    const hotspot = makeHotspot({
      type: "module",
      key: "src/controllers",
      findings: [
        makeFinding({ id: "TST-101", domain: "tests", rule: "missing-test-file", severity: "medium" }),
        makeFinding({ id: "TST-102", domain: "tests", rule: "missing-error-path-tests", severity: "low" }),
      ],
      severity_ceiling: "medium",
    });

    const result = inferRootCauseClusters([hotspot], patterns);
    expect(result.clusters).toHaveLength(1);
    expect(result.clusters[0].category).toBe("test-gap");
  });

  it("falls back to isolated category with llm source when no pattern matches", () => {
    const hotspot = makeHotspot({
      type: "pattern",
      key: "rare-rule",
      findings: [
        makeFinding({ id: "OBS-901", domain: "observability", rule: "rare-rule", severity: "low" }),
      ],
      severity_ceiling: "low",
    });

    const result = inferRootCauseClusters([hotspot], []);
    expect(result.clusters).toHaveLength(1);
    expect(result.clusters[0].category).toBe("isolated");
    expect(result.clusters[0].source).toBe("llm");
    expect(result.clusters[0].confidence).toBe(0.6);
    expect(result.metadata.matched_with_rules).toBe(0);
    expect(result.metadata.llm_fallback_count).toBe(1);
  });

  it("groups multiple hotspots into one cluster per category", () => {
    const patterns: RootCausePattern[] = [
      { category: "convention-drift", any_domains: ["conventions"] },
    ];

    const first = makeHotspot({
      key: "src/a.ts",
      findings: [makeFinding({ id: "CNV-001", domain: "conventions", rule: "function-too-long", severity: "high" })],
      severity_ceiling: "high",
    });

    const second = makeHotspot({
      key: "src/b.ts",
      findings: [makeFinding({ id: "CNV-002", domain: "conventions", rule: "naming-convention", severity: "medium" })],
      severity_ceiling: "medium",
    });

    const result = inferRootCauseClusters([first, second], patterns);
    expect(result.total).toBe(1);
    expect(result.clusters[0].category).toBe("convention-drift");
    expect(result.clusters[0].hotspot_count).toBe(2);
    expect(result.clusters[0].severity_ceiling).toBe("high");
  });

  it("sorts clusters by severity ceiling then finding count", () => {
    const patterns: RootCausePattern[] = [
      { category: "security-shortcut", any_domains: ["security"] },
      { category: "test-gap", any_domains: ["tests"] },
    ];

    const securityHotspot = makeHotspot({
      key: "src/auth.ts",
      findings: [
        makeFinding({ id: "SEC-001", domain: "security", rule: "hardcoded-secret", severity: "critical" }),
      ],
      severity_ceiling: "critical",
    });

    const testHotspot = makeHotspot({
      key: "src/user.test.ts",
      findings: [
        makeFinding({ id: "TST-001", domain: "tests", rule: "missing-error-path-tests", severity: "medium" }),
      ],
      severity_ceiling: "medium",
    });

    const result = inferRootCauseClusters([testHotspot, securityHotspot], patterns);
    expect(result.clusters[0].category).toBe("security-shortcut");
    expect(result.clusters[1].category).toBe("test-gap");
  });
});
