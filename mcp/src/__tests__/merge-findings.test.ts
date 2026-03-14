import { describe, it, expect } from "vitest";
import { mergeReports } from "../merger/merge-findings.js";
import { makeFinding, makeDomainReport } from "./fixtures.js";
import type { RootCauseCluster } from "../merger/root-cause.js";
import type { RemediationPlan } from "../merger/prioritize.js";

describe("mergeReports", () => {
  it("produces a consolidated report with correct metadata", () => {
    const reports = [makeDomainReport()];
    const result = mergeReports(reports, "my-project", "java-angular-playwright");

    expect(result.metadata.target).toBe("my-project");
    expect(result.metadata.profile).toBe("java-angular-playwright");
    expect(result.metadata.domains_audited).toContain("security");
  });

  it("computes overall_score from domain scores", () => {
    const reports = [
      makeDomainReport({ domain: "security", score: 100, findings: [] }),
      makeDomainReport({ domain: "tests", score: 100, findings: [] }),
    ];
    const result = mergeReports(reports, "proj", "default");
    expect(result.overall_score).toBe(100);
    expect(result.grade).toBe("A");
  });

  it("deduplicates findings across domains", () => {
    const sharedFinding = makeFinding({ rule: "SEC-001", evidence: [{ file: "auth.ts", line: 5 }] });
    const reports = [
      makeDomainReport({ domain: "security", findings: [sharedFinding] }),
      makeDomainReport({ domain: "architecture", findings: [sharedFinding] }),
    ];
    const result = mergeReports(reports, "proj", "default");
    expect(result.statistics?.total_findings).toBe(1);
  });

  it("top_findings are sorted by severity then confidence", () => {
    const critical = makeFinding({
      id: "SEC-001",
      severity: "critical",
      confidence: 0.9,
      rule: "r1",
      evidence: [{ file: "a.ts" }],
    });
    const high = makeFinding({
      id: "SEC-002",
      severity: "high",
      confidence: 1.0,
      rule: "r2",
      evidence: [{ file: "b.ts" }],
    });
    const medium = makeFinding({
      id: "SEC-003",
      severity: "medium",
      confidence: 1.0,
      rule: "r3",
      evidence: [{ file: "c.ts" }],
    });
    const reports = [makeDomainReport({ findings: [medium, high, critical] })];

    const result = mergeReports(reports, "proj", "default");
    expect(result.top_findings[0].severity).toBe("critical");
    expect(result.top_findings[1].severity).toBe("high");
    expect(result.top_findings[2].severity).toBe("medium");
  });

  it("caps top_findings at 10", () => {
    const findings = Array.from({ length: 15 }, (_, i) =>
      makeFinding({ id: `SEC-${String(i).padStart(3, "0")}`, rule: `rule-${i}`, evidence: [{ file: `f${i}.ts` }] }),
    );
    const reports = [makeDomainReport({ findings })];
    const result = mergeReports(reports, "proj", "default");
    expect(result.top_findings).toHaveLength(10);
  });

  it("counts findings by severity in statistics", () => {
    const findings = [
      makeFinding({ id: "SEC-001", severity: "critical", rule: "r1", evidence: [{ file: "a.ts" }] }),
      makeFinding({ id: "SEC-002", severity: "critical", rule: "r2", evidence: [{ file: "b.ts" }] }),
      makeFinding({ id: "SEC-003", severity: "low", rule: "r3", evidence: [{ file: "c.ts" }] }),
    ];
    const result = mergeReports([makeDomainReport({ findings })], "proj", "default");
    expect(result.statistics?.by_severity?.critical).toBe(2);
    expect(result.statistics?.by_severity?.low).toBe(1);
    expect(result.statistics?.by_severity?.high).toBe(0);
  });

  it("summary mentions grade and finding counts", () => {
    const reports = [makeDomainReport({ score: 95, findings: [] })];
    const result = mergeReports(reports, "proj", "default");
    expect(result.summary).toMatch(/Grade A/);
  });

  it("supports optional diagnostic fields on consolidated output", () => {
    const reports = [makeDomainReport({ findings: [makeFinding({ id: "SEC-123", rule: "r-diag" })] })];
    const base = mergeReports(reports, "proj", "default");

    const cluster: RootCauseCluster = {
      category: "security-shortcut",
      source: "tool",
      confidence: 0.9,
      rationale: "Security controls are inconsistent.",
      hotspot_count: 1,
      finding_count: 1,
      domain_count: 1,
      domains: ["security"],
      severity_ceiling: "high",
      hotspots: [
        {
          type: "file",
          key: "src/auth.ts",
          label: "src/auth.ts",
          finding_count: 1,
          domain_count: 1,
          domains: ["security"],
          severity_ceiling: "high",
          findings: [makeFinding({ id: "SEC-123", rule: "r-diag" })],
        },
      ],
    };

    const remediationPlan: RemediationPlan = {
      current_score: base.overall_score,
      fix_now: [],
      next_sprint: [],
      backlog: [],
      score_after_fix_now: base.overall_score,
      score_after_all: base.overall_score,
      summary: "No immediate fixes.",
      metadata: {
        total_clusters: 1,
        fix_now_count: 0,
        next_sprint_count: 0,
        backlog_count: 1,
      },
    };

    const enriched = {
      ...base,
      clusters: [cluster],
      remediation_plan: remediationPlan,
    };

    expect(enriched.clusters).toHaveLength(1);
    expect(enriched.remediation_plan.metadata.total_clusters).toBe(1);
  });
});
