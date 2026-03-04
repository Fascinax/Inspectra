import type { DomainReport, Finding } from "../types.js";
import type { GradeConfig, ConfidenceAdjustment, SeverityMatrixConfig } from "../policies/loader.js";
import { deriveGrade } from "./score.js";

/**
 * Builds a human-readable summary string from scoring data.
 * Pure presentation — no side effects.
 */
export function buildSummary(
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

  const worstDomain = findWorstDomain(domainReports);

  let text = `Overall score: ${score}/100 (Grade ${grade}). Findings: ${parts.join(", ") || "none"}.`;
  if (worstDomain && worstDomain.score < 70) {
    text += ` Priority area: ${worstDomain.domain} (${worstDomain.score}/100).`;
  }
  if (severityMatrix) {
    text += formatSlaSuffix(bySeverity, severityMatrix);
  }
  return text;
}

function findWorstDomain(domainReports: DomainReport[]): DomainReport | null {
  return domainReports.length > 0
    ? domainReports.reduce((worst, r) => (r.score < worst.score ? r : worst))
    : null;
}

function formatSlaSuffix(
  bySeverity: Record<string, number>,
  severityMatrix: SeverityMatrixConfig,
): string {
  const slaItems = (["critical", "high", "medium"] as const)
    .filter((sev) => (bySeverity[sev] ?? 0) > 0)
    .map((sev) => {
      const lvl = severityMatrix.severity_defaults[sev];
      return lvl?.sla_days != null ? `${sev} ≤${lvl.sla_days}d` : null;
    })
    .filter((s): s is string => s !== null);

  return slaItems.length > 0 ? ` Fix SLA: ${slaItems.join(", ")}.` : "";
}

/**
 * Applies confidence adjustments (bump/penalize) based on evidence conditions.
 * Returns the same array when no adjustments are configured.
 */
export function applyConfidenceAdjustments(
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

export function matchesCondition(finding: Finding, condition: string): boolean {
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
