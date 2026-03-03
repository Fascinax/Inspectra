import { describe, it, expect } from "vitest";
import { computePrDelta, renderPrComment, extractInlineAnnotations } from "../cli/pr-report.js";
import { makeFinding, makeDomainReport } from "./fixtures.js";
import type { ConsolidatedReport } from "../types.js";

// ─── Helpers ─────────────────────────────────────────────────────────────────

function makeReport(overrides: Partial<ConsolidatedReport> = {}): ConsolidatedReport {
  return {
    overall_score: 78,
    grade: "B",
    summary: "Overall score: 78/100",
    domain_reports: [
      makeDomainReport({
        domain: "security",
        score: 72,
        findings: [
          makeFinding({ id: "SEC-001", severity: "high", title: "Hardcoded API key" }),
          makeFinding({ id: "SEC-002", severity: "medium", title: "Missing CSP header", rule: "missing-csp" }),
        ],
      }),
      makeDomainReport({
        domain: "tests",
        score: 85,
        findings: [
          makeFinding({ id: "TST-001", severity: "medium", title: "Low coverage", domain: "tests", rule: "low-coverage" }),
        ],
      }),
    ],
    top_findings: [],
    statistics: { total_findings: 3, by_severity: { critical: 0, high: 1, medium: 2, low: 0, info: 0 } },
    metadata: { timestamp: "2026-03-03T10:00:00.000Z", target: "/app", profile: "generic" },
    ...overrides,
  };
}

// ─── computePrDelta ──────────────────────────────────────────────────────────

describe("computePrDelta", () => {
  it("computes positive overall delta when current is better", () => {
    const current = makeReport({ overall_score: 85, grade: "B" });
    const baseline = makeReport({ overall_score: 70, grade: "C" });

    const delta = computePrDelta(current, baseline);

    expect(delta.overallDelta).toBe(15);
    expect(delta.currentScore).toBe(85);
    expect(delta.baselineScore).toBe(70);
  });

  it("computes negative overall delta when current is worse", () => {
    const current = makeReport({ overall_score: 60, grade: "C" });
    const baseline = makeReport({ overall_score: 80, grade: "B" });

    const delta = computePrDelta(current, baseline);

    expect(delta.overallDelta).toBe(-20);
  });

  it("computes zero delta when scores are equal", () => {
    const current = makeReport({ overall_score: 75, grade: "B" });
    const baseline = makeReport({ overall_score: 75, grade: "B" });

    const delta = computePrDelta(current, baseline);

    expect(delta.overallDelta).toBe(0);
  });

  it("computes per-domain deltas", () => {
    const current = makeReport();
    const baseline = makeReport({
      domain_reports: [
        makeDomainReport({ domain: "security", score: 60 }),
        makeDomainReport({ domain: "tests", score: 90 }),
      ],
    });

    const delta = computePrDelta(current, baseline);

    const secDelta = delta.domainDeltas.find((d) => d.domain === "security");
    expect(secDelta?.delta).toBe(12); // 72 - 60
    expect(secDelta?.trend).toBe("improved");

    const testDelta = delta.domainDeltas.find((d) => d.domain === "tests");
    expect(testDelta?.delta).toBe(-5); // 85 - 90
    expect(testDelta?.trend).toBe("degraded");
  });

  it("uses 100 as baseline for new domains not in baseline", () => {
    const current = makeReport();
    const baseline = makeReport({
      domain_reports: [makeDomainReport({ domain: "security", score: 60 })],
    });

    const delta = computePrDelta(current, baseline);
    const testDelta = delta.domainDeltas.find((d) => d.domain === "tests");

    expect(testDelta?.baseline).toBe(100);
    expect(testDelta?.delta).toBe(-15); // 85 - 100
  });

  it("identifies new findings not present in baseline", () => {
    const current = makeReport({
      domain_reports: [
        makeDomainReport({
          domain: "security",
          findings: [
            makeFinding({ id: "SEC-001" }),
            makeFinding({ id: "SEC-099", severity: "critical", title: "New vulnerability" }),
          ],
        }),
      ],
    });
    const baseline = makeReport({
      domain_reports: [
        makeDomainReport({ domain: "security", findings: [makeFinding({ id: "SEC-001" })] }),
      ],
    });

    const delta = computePrDelta(current, baseline);

    expect(delta.newFindings).toHaveLength(1);
    expect(delta.newFindings[0]?.id).toBe("SEC-099");
  });

  it("identifies fixed findings removed from baseline", () => {
    const current = makeReport({
      domain_reports: [
        makeDomainReport({ domain: "security", findings: [makeFinding({ id: "SEC-001" })] }),
      ],
    });
    const baseline = makeReport({
      domain_reports: [
        makeDomainReport({
          domain: "security",
          findings: [
            makeFinding({ id: "SEC-001" }),
            makeFinding({ id: "SEC-042", title: "Old vuln", severity: "medium", rule: "old-vuln" }),
          ],
        }),
      ],
    });

    const delta = computePrDelta(current, baseline);

    expect(delta.fixedFindings).toHaveLength(1);
    expect(delta.fixedFindings[0]?.id).toBe("SEC-042");
  });

  it("sorts new findings by severity (critical first)", () => {
    const current = makeReport({
      domain_reports: [
        makeDomainReport({
          domain: "security",
          findings: [
            makeFinding({ id: "SEC-010", severity: "low" }),
            makeFinding({ id: "SEC-011", severity: "critical" }),
            makeFinding({ id: "SEC-012", severity: "high" }),
          ],
        }),
      ],
    });
    const baseline = makeReport({ domain_reports: [makeDomainReport({ domain: "security", findings: [] })] });

    const delta = computePrDelta(current, baseline);

    expect(delta.newFindings[0]?.severity).toBe("critical");
    expect(delta.newFindings[1]?.severity).toBe("high");
    expect(delta.newFindings[2]?.severity).toBe("low");
  });

  // ── Merge Decision ──

  it("blocks merge when critical findings exist", () => {
    const current = makeReport({
      domain_reports: [
        makeDomainReport({
          domain: "security",
          findings: [makeFinding({ id: "SEC-001", severity: "critical" })],
        }),
      ],
    });
    const baseline = makeReport({ domain_reports: [] });

    const delta = computePrDelta(current, baseline);

    expect(delta.mergeDecision.allowed).toBe(false);
    expect(delta.mergeDecision.criticalCount).toBe(1);
    expect(delta.mergeDecision.reason).toContain("critical");
  });

  it("blocks merge when 3 or more new high findings are introduced", () => {
    const current = makeReport({
      domain_reports: [
        makeDomainReport({
          domain: "security",
          findings: [
            makeFinding({ id: "SEC-010", severity: "high" }),
            makeFinding({ id: "SEC-011", severity: "high" }),
            makeFinding({ id: "SEC-012", severity: "high" }),
          ],
        }),
      ],
    });
    const baseline = makeReport({ domain_reports: [makeDomainReport({ domain: "security", findings: [] })] });

    const delta = computePrDelta(current, baseline);

    expect(delta.mergeDecision.allowed).toBe(false);
    expect(delta.mergeDecision.reason).toContain("high-severity");
  });

  it("allows merge when no critical findings and fewer than 3 new highs", () => {
    const current = makeReport({
      domain_reports: [
        makeDomainReport({
          domain: "security",
          findings: [
            makeFinding({ id: "SEC-001", severity: "high" }),
            makeFinding({ id: "SEC-002", severity: "medium", rule: "something" }),
          ],
        }),
      ],
    });
    const baseline = makeReport({ domain_reports: [makeDomainReport({ domain: "security", findings: [] })] });

    const delta = computePrDelta(current, baseline);

    expect(delta.mergeDecision.allowed).toBe(true);
    expect(delta.mergeDecision.reason).toContain("allowed");
  });

  it("allows merge when report has no findings at all", () => {
    const current = makeReport({
      overall_score: 100,
      grade: "A",
      domain_reports: [makeDomainReport({ domain: "security", score: 100, findings: [] })],
    });
    const baseline = makeReport({
      overall_score: 100,
      grade: "A",
      domain_reports: [makeDomainReport({ domain: "security", score: 100, findings: [] })],
    });

    const delta = computePrDelta(current, baseline);

    expect(delta.mergeDecision.allowed).toBe(true);
    expect(delta.newFindings).toHaveLength(0);
    expect(delta.fixedFindings).toHaveLength(0);
  });
});

// ─── renderPrComment ─────────────────────────────────────────────────────────

describe("renderPrComment", () => {
  it("includes the audit report header", () => {
    const delta = computePrDelta(makeReport(), makeReport());
    const comment = renderPrComment(delta);

    expect(comment).toContain("## 🔍 Inspectra Audit Report");
  });

  it("shows overall score and grade", () => {
    const delta = computePrDelta(
      makeReport({ overall_score: 82, grade: "B" }),
      makeReport({ overall_score: 75, grade: "B" }),
    );
    const comment = renderPrComment(delta);

    expect(comment).toContain("82/100");
    expect(comment).toContain("Grade **B**");
  });

  it("shows positive delta with up arrow", () => {
    const delta = computePrDelta(
      makeReport({ overall_score: 85, grade: "B" }),
      makeReport({ overall_score: 70, grade: "C" }),
    );
    const comment = renderPrComment(delta);

    expect(comment).toContain("▲");
    expect(comment).toContain("+15");
  });

  it("shows negative delta with down arrow", () => {
    const delta = computePrDelta(
      makeReport({ overall_score: 55, grade: "C" }),
      makeReport({ overall_score: 80, grade: "B" }),
    );
    const comment = renderPrComment(delta);

    expect(comment).toContain("▼");
    expect(comment).toContain("-25");
  });

  it("includes domain breakdown table", () => {
    const delta = computePrDelta(makeReport(), makeReport());
    const comment = renderPrComment(delta);

    expect(comment).toContain("### Domain Breakdown");
    expect(comment).toContain("Security");
    expect(comment).toContain("Tests");
  });

  it("shows new findings section when there are new findings", () => {
    const current = makeReport({
      domain_reports: [
        makeDomainReport({
          domain: "security",
          findings: [makeFinding({ id: "SEC-099", title: "Brand new issue" })],
        }),
      ],
    });
    const baseline = makeReport({ domain_reports: [makeDomainReport({ domain: "security", findings: [] })] });

    const delta = computePrDelta(current, baseline);
    const comment = renderPrComment(delta);

    expect(comment).toContain("⚠️ New Findings");
    expect(comment).toContain("SEC-099");
    expect(comment).toContain("Brand new issue");
  });

  it("shows 'No New Findings' when nothing is new", () => {
    const delta = computePrDelta(makeReport(), makeReport());
    const comment = renderPrComment(delta);

    expect(comment).toContain("✅ No New Findings");
  });

  it("shows fixed findings section", () => {
    const current = makeReport({
      domain_reports: [makeDomainReport({ domain: "security", findings: [] })],
    });
    const baseline = makeReport({
      domain_reports: [
        makeDomainReport({
          domain: "security",
          findings: [makeFinding({ id: "SEC-042", title: "Resolved issue" })],
        }),
      ],
    });

    const delta = computePrDelta(current, baseline);
    const comment = renderPrComment(delta);

    expect(comment).toContain("🎉 Fixed");
    expect(comment).toContain("~~SEC-042 Resolved issue~~");
  });

  it("shows merge blocked when critical findings exist", () => {
    const current = makeReport({
      domain_reports: [
        makeDomainReport({
          domain: "security",
          findings: [makeFinding({ id: "SEC-001", severity: "critical" })],
        }),
      ],
    });
    const baseline = makeReport({ domain_reports: [] });

    const delta = computePrDelta(current, baseline);
    const comment = renderPrComment(delta);

    expect(comment).toContain("❌ Merge Decision");
    expect(comment).toContain("critical");
  });

  it("shows merge allowed when no blockers", () => {
    const current = makeReport({
      domain_reports: [
        makeDomainReport({ domain: "security", findings: [makeFinding({ severity: "low" })] }),
      ],
    });
    const baseline = makeReport({ domain_reports: [] });

    const delta = computePrDelta(current, baseline);
    const comment = renderPrComment(delta);

    expect(comment).toContain("✅ Merge Decision");
  });

  it("includes Inspectra footer", () => {
    const delta = computePrDelta(makeReport(), makeReport());
    const comment = renderPrComment(delta);

    expect(comment).toContain("Generated by [Inspectra]");
  });
});

// ─── extractInlineAnnotations ────────────────────────────────────────────────

describe("extractInlineAnnotations", () => {
  it("extracts annotations from findings with file and line", () => {
    const findings = [
      makeFinding({ id: "SEC-001", evidence: [{ file: "src/config.ts", line: 42 }] }),
      makeFinding({ id: "SEC-002", evidence: [{ file: "src/auth.ts", line: 10 }] }),
    ];

    const annotations = extractInlineAnnotations(findings);

    expect(annotations).toHaveLength(2);
    expect(annotations[0]?.path).toBe("src/config.ts");
    expect(annotations[0]?.line).toBe(42);
    expect(annotations[1]?.path).toBe("src/auth.ts");
    expect(annotations[1]?.line).toBe(10);
  });

  it("skips findings without line numbers", () => {
    const findings = [makeFinding({ id: "SEC-001", evidence: [{ file: "src/config.ts" }] })];

    const annotations = extractInlineAnnotations(findings);

    expect(annotations).toHaveLength(0);
  });

  it("skips findings without evidence", () => {
    // Can't create a Finding without evidence per schema, but test with empty array
    const findings = [makeFinding({ id: "SEC-001", evidence: [{ file: "src/foo.ts", line: 1 }] })];
    // Remove evidence manually for edge case
    const noEvidence = { ...findings[0]!, evidence: [] };

    const annotations = extractInlineAnnotations([noEvidence as any]);

    expect(annotations).toHaveLength(0);
  });

  it("includes severity in annotation", () => {
    const findings = [
      makeFinding({ id: "SEC-001", severity: "critical", evidence: [{ file: "src/x.ts", line: 5 }] }),
    ];

    const annotations = extractInlineAnnotations(findings);

    expect(annotations[0]?.severity).toBe("critical");
  });

  it("includes finding title and recommendation in body", () => {
    const findings = [
      makeFinding({
        id: "SEC-001",
        title: "API key exposed",
        recommendation: "Use env vars",
        evidence: [{ file: "src/config.ts", line: 12 }],
      }),
    ];

    const annotations = extractInlineAnnotations(findings);

    expect(annotations[0]?.body).toContain("API key exposed");
    expect(annotations[0]?.body).toContain("Use env vars");
  });

  it("includes severity icon in body", () => {
    const findings = [
      makeFinding({ id: "SEC-001", severity: "high", evidence: [{ file: "src/x.ts", line: 1 }] }),
    ];

    const annotations = extractInlineAnnotations(findings);

    expect(annotations[0]?.body).toContain("🟠");
  });

  it("returns empty array for empty findings", () => {
    expect(extractInlineAnnotations([])).toEqual([]);
  });
});
