import type { Finding, DomainReport, Grade } from "../types.js";
import type { ScoringConfig } from "../policies/loader.js";
import { DEFAULT_SCORING } from "../policies/loader.js";

export function scoreDomain(findings: Finding[], config?: ScoringConfig): number {
  if (findings.length === 0) return 100;

  const weights = config?.severity_weights ?? DEFAULT_SCORING.severity_weights;
  const penalty = findings.reduce((sum, f) => sum + (weights[f.severity] ?? 0) * f.confidence, 0);
  return Math.max(0, Math.round(100 - penalty));
}

export function computeOverallScore(domainReports: DomainReport[], config?: ScoringConfig): number {
  if (domainReports.length === 0) return 0;

  const domainWeights = config?.domain_weights ?? DEFAULT_SCORING.domain_weights;

  let weightedSum = 0;
  let totalWeight = 0;

  for (const report of domainReports) {
    const weight = domainWeights[report.domain] ?? 0.1;
    weightedSum += report.score * weight;
    totalWeight += weight;
  }

  return totalWeight > 0 ? Math.round(weightedSum / totalWeight) : 0;
}

export function deriveGrade(score: number): Grade {
  if (score >= 90) return "A";
  if (score >= 75) return "B";
  if (score >= 60) return "C";
  if (score >= 40) return "D";
  return "F";
}
