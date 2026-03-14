import { SEVERITY_RANK, type DomainReport, type ConsolidatedReport } from "../types.js";
import type { MergeOptions } from "../policies/loader.js";
import { deduplicateFindings } from "./deduplicate.js";
import { computeOverallScore, deriveGrade } from "./score.js";
import { buildSummary, applyConfidenceAdjustments } from "./merge-helpers.js";
import { applyIgnoreRules } from "../utils/ignore.js";

/**
 * Merges domain reports into a single consolidated audit report.
 * Applies confidence filtering, deduplication, scoring, and grade derivation.
 */
export function mergeReports(
  domainReports: DomainReport[],
  target: string,
  profile: string,
  options?: MergeOptions,
): ConsolidatedReport {
  const allFindings = domainReports.flatMap((r) => r.findings);

  const minConfidence = options?.confidence?.minimum_for_report ?? 0;
  const autoDismiss = options?.confidence?.auto_dismiss_below ?? 0;
  const filtered = allFindings.filter((f) => f.confidence >= autoDismiss && f.confidence >= minConfidence);

  const adjusted = applyConfidenceAdjustments(filtered, options?.confidence?.adjustments ?? []);
  const ignored = applyIgnoreRules(adjusted, options?.ignoreRules ?? []);
  const deduplicated = deduplicateFindings(ignored, options?.deduplication);

  const ranked = [...deduplicated].sort((a, b) => {
    const sevDiff = SEVERITY_RANK[b.severity] - SEVERITY_RANK[a.severity];
    if (sevDiff !== 0) return sevDiff;
    return b.confidence - a.confidence;
  });

  const { bySeverity, byDomain } = computeStatistics(deduplicated);
  const overallScore = computeOverallScore(domainReports, options?.scoring);

  return {
    overall_score: overallScore,
    grade: deriveGrade(overallScore, options?.scoring?.grades),
    summary: buildSummary(overallScore, bySeverity, domainReports, options?.scoring?.grades, options?.severityMatrix),
    domain_reports: domainReports,
    top_findings: ranked.slice(0, 10),
    statistics: {
      total_findings: deduplicated.length,
      by_severity: bySeverity,
      by_domain: byDomain,
    },
    metadata: {
      timestamp: new Date().toISOString(),
      target,
      profile,
      domains_audited: domainReports.map((r) => r.domain),
    },
  };
}

function computeStatistics(findings: ReadonlyArray<{ severity: string; domain: string }>) {
  const bySeverity: Record<string, number> & { critical: number; high: number; medium: number; low: number; info: number } = { critical: 0, high: 0, medium: 0, low: 0, info: 0 };
  const byDomain: Record<string, number> = {};
  for (const f of findings) {
    bySeverity[f.severity] = (bySeverity[f.severity] ?? 0) + 1;
    byDomain[f.domain] = (byDomain[f.domain] ?? 0) + 1;
  }
  return { bySeverity, byDomain };
}
