import type { DomainReport, Finding, ConsolidatedReport } from "../types.js";
import { deduplicateFindings } from "./deduplicate.js";
import { computeOverallScore, deriveGrade } from "./score.js";

const SEVERITY_ORDER: Record<Finding["severity"], number> = {
  critical: 0,
  high: 1,
  medium: 2,
  low: 3,
  info: 4,
};

export function mergeReports(domainReports: DomainReport[], target: string, profile: string): ConsolidatedReport {
  const allFindings = domainReports.flatMap((r) => r.findings);
  const deduplicated = deduplicateFindings(allFindings);

  const ranked = [...deduplicated].sort((a, b) => {
    const sevDiff = SEVERITY_ORDER[a.severity] - SEVERITY_ORDER[b.severity];
    if (sevDiff !== 0) return sevDiff;
    return b.confidence - a.confidence;
  });

  const topFindings = ranked.slice(0, 10);
  const overallScore = computeOverallScore(domainReports);

  const bySeverity = { critical: 0, high: 0, medium: 0, low: 0, info: 0 };
  const byDomain: Record<string, number> = {};

  for (const f of deduplicated) {
    bySeverity[f.severity]++;
    byDomain[f.domain] = (byDomain[f.domain] ?? 0) + 1;
  }

  const summary = buildSummary(overallScore, bySeverity, domainReports);

  return {
    overall_score: overallScore,
    grade: deriveGrade(overallScore),
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
  domainReports: DomainReport[]
): string {
  const grade = deriveGrade(score);
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

  return text;
}
