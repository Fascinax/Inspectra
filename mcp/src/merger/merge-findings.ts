import type { DomainReport, Finding, ConsolidatedReport } from "../types.js";
import type { MergeOptions, GradeConfig, ConfidenceAdjustment, SeverityMatrixConfig } from "../policies/loader.js";
import { deduplicateFindings } from "./deduplicate.js";
import { computeOverallScore, deriveGrade } from "./score.js";

const SEVERITY_ORDER: Record<Finding["severity"], number> = {
  critical: 0,
  high: 1,
  medium: 2,
  low: 3,
  info: 4,
};

export function mergeReports(
  domainReports: DomainReport[],
  target: string,
  profile: string,
  options?: MergeOptions,
): ConsolidatedReport {
  const allFindings = domainReports.flatMap((r) => r.findings);

  const minConfidence = options?.confidence?.minimum_for_report ?? 0;
  const autoDismiss = options?.confidence?.auto_dismiss_below ?? 0;
  const filtered = allFindings.filter((f) =>
    f.confidence >= autoDismiss && f.confidence >= minConfidence,
  );

  const adjusted = applyConfidenceAdjustments(filtered, options?.confidence?.adjustments ?? []);

  const deduplicated = deduplicateFindings(
    adjusted,
    options?.deduplication,
  );

  const ranked = [...deduplicated].sort((a, b) => {
    const sevDiff = SEVERITY_ORDER[a.severity] - SEVERITY_ORDER[b.severity];
    if (sevDiff !== 0) return sevDiff;
    return b.confidence - a.confidence;
  });

  const topFindings = ranked.slice(0, 10);
  const overallScore = computeOverallScore(domainReports, options?.scoring);

  const bySeverity = { critical: 0, high: 0, medium: 0, low: 0, info: 0 };
  const byDomain: Record<string, number> = {};

  for (const f of deduplicated) {
    bySeverity[f.severity]++;
    byDomain[f.domain] = (byDomain[f.domain] ?? 0) + 1;
  }

  const summary = buildSummary(overallScore, bySeverity, domainReports, options?.scoring?.grades, options?.severityMatrix);

  return {
    overall_score: overallScore,
    grade: deriveGrade(overallScore, options?.scoring?.grades),
    summary,
    domain_reports: domainReports,
    top_findings: topFindings,
    statistics: {
      total_findings: deduplicated.length,
      by_severity: bySeverity,
      by_domain: byDomain,
    },
    metadata: {
      timestamp: new Date().toISOString(),
      target,
      profile,
      agents_invoked: domainReports.map((r) => r.metadata.agent),
    },
  };
}

function buildSummary(
  score: number,
  bySeverity: Record<string, number>,
  domainReports: DomainReport[],
  grades?: Record<string, GradeConfig>,
  severityMatrix?: SeverityMatrixConfig,
): string {
  const grade = deriveGrade(score, grades);
  const parts = Object.entries(bySeverity)
    .filter(([, count]) => count > 0)
    .map(([sev, count]) => `${count} ${sev}`);

  const worstDomain = domainReports.length > 0
    ? domainReports.reduce((worst, r) => (r.score < worst.score ? r : worst))
    : null;

  let text = `Overall score: ${score}/100 (Grade ${grade}). Findings: ${parts.join(", ") || "none"}.`;
  if (worstDomain && worstDomain.score < 70) {
    text += ` Priority area: ${worstDomain.domain} (${worstDomain.score}/100).`;
  }
  if (severityMatrix) {
    const slaItems = (["critical", "high", "medium"] as const)
      .filter((sev) => (bySeverity[sev] ?? 0) > 0)
      .map((sev) => {
        const lvl = severityMatrix.severity_defaults[sev];
        return lvl?.sla_days != null ? `${sev} ≤${lvl.sla_days}d` : null;
      })
      .filter((s): s is string => s !== null);
    if (slaItems.length > 0) {
      text += ` Fix SLA: ${slaItems.join(", ")}.`;
    }
  }

  return text;
}

function applyConfidenceAdjustments(
  findings: Finding[],
  adjustments: ConfidenceAdjustment[],
): Finding[] {
  if (adjustments.length === 0) return findings;
  return findings.map((f) => {
    let adjusted = f.confidence;
    for (const adj of adjustments) {
      if (matchesCondition(f, adj.condition)) {
        adjusted += adj.delta;
      }
    }
    adjusted = Math.max(0, Math.min(1, adjusted));
    return adjusted !== f.confidence ? { ...f, confidence: adjusted } : f;
  });
}

function matchesCondition(finding: Finding, condition: string): boolean {
  switch (condition) {
    case "evidence_has_snippet":
      return finding.evidence?.some((e) => e.snippet !== undefined) ?? false;
    case "multiple_evidence_locations":
      return (finding.evidence?.length ?? 0) >= 2;
    case "evidence_in_generated_code":
      return finding.evidence?.some((e) => /generated|vendor|dist|node_modules/i.test(e.file)) ?? false;
    case "evidence_in_test_fixtures":
      return finding.evidence?.some((e) => /fixture|mock|stub|fake|__tests__|test-data/i.test(e.file)) ?? false;
    default:
      return false;
  }
}
