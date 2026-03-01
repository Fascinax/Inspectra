import type { Finding, DomainReport, Grade } from "../types.js";
import type { ScoringConfig, GradeConfig } from "../policies/loader.js";
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

const DEFAULT_GRADE_THRESHOLDS: Array<{ grade: Grade; min_score: number }> = [
  { grade: "A", min_score: 90 },
  { grade: "B", min_score: 75 },
  { grade: "C", min_score: 60 },
  { grade: "D", min_score: 40 },
  { grade: "F", min_score: 0 },
];

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
