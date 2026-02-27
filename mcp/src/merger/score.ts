import type { Finding, DomainReport, Grade } from "../types.js";

const SEVERITY_WEIGHTS: Record<Finding["severity"], number> = {
  critical: 25,
  high: 15,
  medium: 8,
  low: 3,
  info: 0,
};

const DEFAULT_DOMAIN_WEIGHTS: Record<string, number> = {
  security: 0.30,
  tests: 0.25,
  architecture: 0.20,
  conventions: 0.15,
  performance: 0.05,
  documentation: 0.05,
};

export function scoreDomain(findings: Finding[]): number {
  if (findings.length === 0) return 100;

  const penalty = findings.reduce((sum, f) => sum + SEVERITY_WEIGHTS[f.severity] * f.confidence, 0);
  return Math.max(0, Math.round(100 - penalty));
}

export function computeOverallScore(domainReports: DomainReport[]): number {
  if (domainReports.length === 0) return 0;

  let weightedSum = 0;
  let totalWeight = 0;

  for (const report of domainReports) {
    const weight = DEFAULT_DOMAIN_WEIGHTS[report.domain] ?? 0.1;
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
