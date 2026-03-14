import { describe, it, expect } from "vitest";
import { buildRemediationPlan } from "../merger/prioritize.js";
import type { RootCauseCluster } from "../merger/root-cause.js";
import type { ScoringConfig } from "../policies/loader.js";
import { makeFinding } from "./fixtures.js";
import type { Hotspot } from "../merger/correlate.js";
import type { Domain } from "../types.js";

function makeHotspot(overrides: Partial<Hotspot> = {}): Hotspot {
  const findings = overrides.findings ?? [makeFinding()];
  return {
    type: "file",
    key: "src/file.ts",
    label: "File hotspot",
    finding_count: findings.length,
    domain_count: new Set(findings.map((f) => f.domain)).size,
    domains: [...new Set(findings.map((f) => f.domain))],
    severity_ceiling: findings[0].severity,
    findings,
    ...overrides,
  };
}

function makeCluster(overrides: Partial<RootCauseCluster> = {}): RootCauseCluster {
  const hotspots = overrides.hotspots ?? [makeHotspot()];
  const allDomains = [...new Set(hotspots.flatMap((h) => h.domains))] as Domain[];
  return {
    category: "security-shortcut",
    source: "tool",
    confidence: 0.9,
    rationale: "Security findings concentrated in config files.",
    hotspot_count: hotspots.length,
    finding_count: hotspots.reduce((s, h) => s + h.finding_count, 0),
    domain_count: allDomains.length,
    domains: allDomains,
    severity_ceiling: "high",
    hotspots,
    ...overrides,
  };
}

const MINIMAL_SCORING: ScoringConfig = {
  severity_weights: { critical: 25, high: 15, medium: 8, low: 3, info: 0 },
  domain_weights: {
    security: 0.24,
    tests: 0.2,
    architecture: 0.16,
    conventions: 0.12,
    performance: 0.1,
    documentation: 0.08,
    "tech-debt": 0.1,
    accessibility: 0.08,
    "api-design": 0.07,
    observability: 0.06,
    i18n: 0.05,
    "ux-consistency": 0.06,
  },
};

describe("buildRemediationPlan", () => {
  it("returns an empty plan for no clusters", () => {
    const plan = buildRemediationPlan([], 75, MINIMAL_SCORING);
    expect(plan.fix_now).toHaveLength(0);
    expect(plan.next_sprint).toHaveLength(0);
    expect(plan.backlog).toHaveLength(0);
    expect(plan.score_after_fix_now).toBe(75);
    expect(plan.score_after_all).toBe(75);
    expect(plan.metadata.total_clusters).toBe(0);
  });

  it("buckets a critical cluster into fix_now", () => {
    const cluster = makeCluster({
      severity_ceiling: "critical",
      domains: ["security"],
      finding_count: 5,
      hotspots: [
        makeHotspot({
          findings: Array.from({ length: 5 }, (_, i) =>
            makeFinding({ id: `SEC-0${i + 1}0`, severity: "critical", domain: "security" }),
          ),
          severity_ceiling: "critical",
        }),
      ],
    });
    const plan = buildRemediationPlan([cluster], 60, MINIMAL_SCORING);
    expect(plan.fix_now).toHaveLength(1);
    expect(plan.fix_now[0].recommended_batch).toBe("fix_now");
    expect(plan.next_sprint).toHaveLength(0);
    expect(plan.backlog).toHaveLength(0);
  });

  it("buckets a low-impact info cluster into backlog", () => {
    const cluster = makeCluster({
      severity_ceiling: "info",
      domains: ["documentation"],
      finding_count: 2,
      hotspots: [
        makeHotspot({
          findings: [
            makeFinding({ id: "DOC-001", severity: "info", domain: "documentation", confidence: 0.6 }),
            makeFinding({ id: "DOC-002", severity: "info", domain: "documentation", confidence: 0.6 }),
          ],
          severity_ceiling: "info",
        }),
      ],
    });
    const plan = buildRemediationPlan([cluster], 80, MINIMAL_SCORING);
    expect(plan.backlog).toHaveLength(1);
    expect(plan.fix_now).toHaveLength(0);
    expect(plan.next_sprint).toHaveLength(0);
  });

  it("estimates score_after_fix_now higher than current when fix_now cluster exists", () => {
    const cluster = makeCluster({
      severity_ceiling: "critical",
      domains: ["security"],
      finding_count: 4,
      hotspots: [
        makeHotspot({
          findings: Array.from({ length: 4 }, (_, i) =>
            makeFinding({ id: `SEC-0${i + 1}0`, severity: "critical", domain: "security", confidence: 0.9 }),
          ),
          severity_ceiling: "critical",
        }),
      ],
    });
    const plan = buildRemediationPlan([cluster], 50, MINIMAL_SCORING);
    expect(plan.score_after_fix_now).toBeGreaterThan(50);
    expect(plan.score_after_all).toBeGreaterThanOrEqual(plan.score_after_fix_now);
  });

  it("sorts fix_now clusters by impact_score descending", () => {
    const highImpact = makeCluster({
      category: "security-shortcut",
      severity_ceiling: "critical",
      domains: ["security"],
      finding_count: 20,
      hotspots: [
        makeHotspot({
          findings: Array.from({ length: 20 }, (_, i) =>
            makeFinding({ id: `SEC-${String(i + 1).padStart(3, "0")}`, severity: "critical", domain: "security" }),
          ),
          severity_ceiling: "critical",
        }),
      ],
    });
    const lowImpact = makeCluster({
      category: "test-gap",
      severity_ceiling: "critical",
      domains: ["tests"],
      finding_count: 1,
      hotspots: [makeHotspot({ findings: [makeFinding({ id: "TST-001", severity: "critical", domain: "tests" })], severity_ceiling: "critical" })],
    });

    const plan = buildRemediationPlan([lowImpact, highImpact], 55, MINIMAL_SCORING);
    expect(plan.fix_now.length).toBeGreaterThanOrEqual(2);
    expect(plan.fix_now[0].impact_score).toBeGreaterThanOrEqual(plan.fix_now[1].impact_score);
  });

  it("generates a non-empty summary string", () => {
    const cluster = makeCluster({ severity_ceiling: "high" });
    const plan = buildRemediationPlan([cluster], 70, MINIMAL_SCORING);
    expect(typeof plan.summary).toBe("string");
    expect(plan.summary.length).toBeGreaterThan(0);
  });

  it("uses DEFAULT_SCORING when no scoring config is provided", () => {
    const cluster = makeCluster({ severity_ceiling: "medium" });
    const plan = buildRemediationPlan([cluster], 70);
    expect(plan.metadata.total_clusters).toBe(1);
    expect(typeof plan.fix_now.length).toBe("number");
  });
});
