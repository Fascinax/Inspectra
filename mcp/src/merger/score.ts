import type { Finding, DomainReport, Grade } from "../types.js";
import { DEFAULT_SCORING, type ScoringConfig, type GradeConfig } from "../policies/loader.js";

/**
 * Computes a 0–100 domain score based on findings and their severities.
 * Higher severity findings reduce the score more sharply.
 * Returns 100 when there are no findings.
 *
 * @param findings - Findings for a single audit domain.
 * @param config - Optional scoring weights and penalty rules.
 * @returns Integer score in range [0, 100].
 */
export function scoreDomain(findings: Finding[], config?: ScoringConfig): number {
  if (findings.length === 0) return 100;

  const weights = config?.severity_weights ?? DEFAULT_SCORING.severity_weights;
  const penalty = findings.reduce((sum, f) => sum + (weights[f.severity] ?? 0) * f.confidence, 0);
  return Math.max(0, Math.round(100 - penalty));
}

/**
 * Computes the overall weighted score across all domain reports.
 * Applies domain weights defined in the scoring config (security 30%, tests 25%, etc.).
 *
 * @param domainReports - Array of scored domain reports.
 * @param config - Optional scoring config with domain weights.
 * @returns Weighted average score in range [0, 100], rounded to one decimal place.
 */
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

const DEFAULT_GRADE_THRESHOLDS: Array<{ grade: Grade; min_score: number }> = [
  { grade: "A", min_score: 90 },
  { grade: "B", min_score: 75 },
  { grade: "C", min_score: 60 },
  { grade: "D", min_score: 40 },
  { grade: "F", min_score: 0 },
];

/**
 * Derives a letter grade (A–F) from a numeric score.
 *
 * @param score - Numeric score in range [0, 100].
 * @param grades - Optional override of grade thresholds from the scoring config.
 * @returns Letter grade string (`"A"`, `"B"`, `"C"`, `"D"`, or `"F"`).
 */
export function deriveGrade(score: number, grades?: Record<string, GradeConfig>): Grade {
  const thresholds = grades
    ? Object.entries(grades)
        .map(([grade, config]) => ({ grade: grade as Grade, min_score: config.min_score }))
        .sort((a, b) => b.min_score - a.min_score)
    : DEFAULT_GRADE_THRESHOLDS;

  for (const { grade, min_score } of thresholds) {
    if (score >= min_score) return grade;
  }
  return "F";
}
