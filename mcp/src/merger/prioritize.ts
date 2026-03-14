import { SEVERITY_RANK, EFFORT_LEVELS, type Effort, type Severity } from "../types.js";
import { DEFAULT_SCORING, type ScoringConfig } from "../policies/loader.js";
import type { RootCauseCluster } from "./root-cause.js";

export type RemediationBatch = "fix_now" | "next_sprint" | "backlog";

export interface PrioritizedCluster {
  cluster: RootCauseCluster;
  /** Computed impact score (0–100). Higher = more urgent. */
  impact_score: number;
  /** Estimated effort to address the cluster. */
  effort: Effort;
  /** Recommended remediation batch. */
  recommended_batch: RemediationBatch;
  /** Estimated overall score improvement if this cluster is fixed. */
  estimated_score_delta: number;
}

export interface RemediationPlan {
  current_score: number;
  fix_now: PrioritizedCluster[];
  next_sprint: PrioritizedCluster[];
  backlog: PrioritizedCluster[];
  /** Projected overall score after resolving Fix Now clusters. */
  score_after_fix_now: number;
  /** Projected overall score after resolving all clusters. */
  score_after_all: number;
  summary: string;
  metadata: {
    total_clusters: number;
    fix_now_count: number;
    next_sprint_count: number;
    backlog_count: number;
  };
}

const EFFORT_THRESHOLDS: Array<{ max: number; effort: Effort }> = [
  { max: 3, effort: "trivial" },
  { max: 8, effort: "small" },
  { max: 15, effort: "medium" },
  { max: 30, effort: "large" },
  { max: Infinity, effort: "epic" },
];

const EFFORT_DIVISORS: Record<Effort, number> = {
  trivial: 1,
  small: 1.5,
  medium: 2.5,
  large: 4,
  epic: 6,
};

const FIX_NOW_IMPACT_THRESHOLD = 50;
const NEXT_SPRINT_IMPACT_THRESHOLD = 20;

/**
 * Builds a prioritized remediation plan from root-cause clusters.
 *
 * Each cluster is scored by impact = (severity × blast_radius × domain_leverage) / effort,
 * then bucketed into Fix Now / Next Sprint / Backlog. Score simulations estimate how much
 * the overall score improves after each remediation batch.
 *
 * @param clusters - Root-cause clusters from `inferRootCauseClusters`.
 * @param currentScore - Current overall audit score (0–100).
 * @param scoring - Optional scoring config (defaults to DEFAULT_SCORING).
 * @returns A `RemediationPlan` with prioritized clusters and score projections.
 */
export function buildRemediationPlan(
  clusters: ReadonlyArray<RootCauseCluster>,
  currentScore: number,
  scoring?: ScoringConfig,
): RemediationPlan {
  const config = scoring ?? DEFAULT_SCORING;
  const prioritized = clusters.map((cluster) => prioritizeCluster(cluster, config));

  const fixNow = prioritized.filter((c) => c.recommended_batch === "fix_now");
  const nextSprint = prioritized.filter((c) => c.recommended_batch === "next_sprint");
  const backlog = prioritized.filter((c) => c.recommended_batch === "backlog");

  const byImpactDesc = (a: PrioritizedCluster, b: PrioritizedCluster) => b.impact_score - a.impact_score;
  fixNow.sort(byImpactDesc);
  nextSprint.sort(byImpactDesc);
  backlog.sort(byImpactDesc);

  const fixNowDelta = fixNow.reduce((sum, c) => sum + c.estimated_score_delta, 0);
  const totalDelta = prioritized.reduce((sum, c) => sum + c.estimated_score_delta, 0);

  const scoreAfterFixNow = clampScore(currentScore + fixNowDelta);
  const scoreAfterAll = clampScore(currentScore + totalDelta);

  return {
    current_score: currentScore,
    fix_now: fixNow,
    next_sprint: nextSprint,
    backlog: backlog,
    score_after_fix_now: scoreAfterFixNow,
    score_after_all: scoreAfterAll,
    summary: buildSummary(currentScore, fixNow, scoreAfterFixNow, scoreAfterAll),
    metadata: {
      total_clusters: clusters.length,
      fix_now_count: fixNow.length,
      next_sprint_count: nextSprint.length,
      backlog_count: backlog.length,
    },
  };
}

function prioritizeCluster(cluster: RootCauseCluster, scoring: ScoringConfig): PrioritizedCluster {
  const effort = estimateEffort(cluster);
  const impactScore = computeImpactScore(cluster, scoring, effort);
  const batch = assignBatch(cluster.severity_ceiling, impactScore);
  const scoreDelta = estimateScoreDelta(cluster, scoring);

  return {
    cluster,
    impact_score: impactScore,
    effort,
    recommended_batch: batch,
    estimated_score_delta: scoreDelta,
  };
}

function estimateEffort(cluster: RootCauseCluster): Effort {
  for (const threshold of EFFORT_THRESHOLDS) {
    if (cluster.finding_count <= threshold.max) return threshold.effort;
  }
  return "epic";
}

function computeImpactScore(cluster: RootCauseCluster, scoring: ScoringConfig, effort: Effort): number {
  const domainWeights = scoring.domain_weights ?? DEFAULT_SCORING.domain_weights;
  const maxDomainWeight = Math.max(...Object.values(domainWeights));

  const severityFactor = SEVERITY_RANK[cluster.severity_ceiling] / 5;

  const blastRadius =
    (Math.min(1, cluster.finding_count / 20) + Math.min(1, cluster.domain_count / 6)) / 2;

  const avgDomainWeight =
    cluster.domains.reduce((sum, d) => sum + (domainWeights[d] ?? 0.05), 0) /
    Math.max(1, cluster.domains.length);
  const leverageFactor = avgDomainWeight / maxDomainWeight;

  const effortDivisor = EFFORT_DIVISORS[effort];

  const raw = (severityFactor * blastRadius * leverageFactor * 100) / effortDivisor;
  return Math.max(0, Math.min(100, Math.round(raw)));
}

function assignBatch(severityCeiling: Severity, impactScore: number): RemediationBatch {
  if (severityCeiling === "critical" || impactScore >= FIX_NOW_IMPACT_THRESHOLD) return "fix_now";
  if (severityCeiling === "high" || impactScore >= NEXT_SPRINT_IMPACT_THRESHOLD) return "next_sprint";
  return "backlog";
}

function estimateScoreDelta(cluster: RootCauseCluster, scoring: ScoringConfig): number {
  const severityWeights = scoring.severity_weights ?? DEFAULT_SCORING.severity_weights;
  const domainWeights = scoring.domain_weights ?? DEFAULT_SCORING.domain_weights;
  const totalWeight = Object.values(domainWeights).reduce((sum, w) => sum + w, 0);

  const domainPenalties = new Map<string, number>();

  for (const hotspot of cluster.hotspots) {
    for (const finding of hotspot.findings) {
      const penalty = (severityWeights[finding.severity] ?? 0) * finding.confidence;
      domainPenalties.set(finding.domain, (domainPenalties.get(finding.domain) ?? 0) + penalty);
    }
  }

  let delta = 0;
  for (const [domain, penalty] of domainPenalties) {
    const weight = domainWeights[domain] ?? 0.05;
    delta += penalty * (weight / totalWeight);
  }

  return Math.max(0, Math.round(delta * 10) / 10);
}

function buildSummary(
  currentScore: number,
  fixNow: PrioritizedCluster[],
  scoreAfterFixNow: number,
  scoreAfterAll: number,
): string {
  if (fixNow.length === 0) {
    return `No critical issues detected (current score: ${currentScore}). Resolving all clusters would bring your score to ${scoreAfterAll}.`;
  }

  // fixNow.length > 0 is guaranteed by the guard above
  // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
  const topCategory = fixNow[0]!.cluster.category;
  const topImprovement = scoreAfterFixNow - currentScore;

  return (
    `${fixNow.length} cluster${fixNow.length > 1 ? "s" : ""} require immediate attention (Fix Now). ` +
    `Top issue: ${topCategory}. ` +
    `Resolving Fix Now clusters improves your score from ${currentScore} to ~${scoreAfterFixNow} (+${topImprovement} pts). ` +
    `Fixing everything brings it to ~${scoreAfterAll}.`
  );
}

function clampScore(score: number): number {
  return Math.max(0, Math.min(100, Math.round(score * 10) / 10));
}

// Re-export for consumers that need the effort levels constant
export { EFFORT_LEVELS };
