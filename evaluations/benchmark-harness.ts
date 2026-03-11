/**
 * Benchmark Evaluation Harness for ADR-008.
 *
 * Loads ground truth, accepts audit output, computes all metrics
 * defined in the ADR: precision, recall, root-cause hit rate,
 * actionability, dedup effectiveness, and diagnostic value.
 */

import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { SEVERITY_WEIGHTS } from "./benchmark-config.js";

// ─── Ground Truth Types ─────────────────────────────────────────────────────

export interface GroundTruthIssue {
  id: string;
  severity: string;
  domain: string;
  title: string;
  file: string;
  line: number;
  tool_detectable: boolean;
  expected_tools: string[];
  root_cause: string | null;
}

export interface RootCause {
  id: string;
  title: string;
  description: string;
  symptoms: string[];
  fix: string;
}

export interface GroundTruth {
  repo: string;
  stack: string;
  description: string;
  expert_ranking: string[];
  root_causes: RootCause[];
  issues: GroundTruthIssue[];
}

// ─── Audit Output Types (matches finding.schema.json) ───────────────────────

export interface AuditFinding {
  id: string;
  severity: string;
  title: string;
  domain: string;
  rule: string;
  confidence: number;
  evidence: Array<{ file: string; line?: number; snippet?: string }>;
  recommendation?: string;
  effort?: string;
  source?: "tool" | "llm";
  tags?: string[];
}

export interface AuditOutput {
  tier: "A" | "B" | "C";
  fixture: string;
  findings: AuditFinding[];
  root_causes_reported?: Array<{ id: string; title: string; symptoms: string[] }>;
  token_count?: number;
  latency_ms?: number;
}

// ─── Metric Results ─────────────────────────────────────────────────────────

export interface MetricResults {
  fixture: string;
  tier: string;
  precision: number;
  recall: number;
  toolRecall: number;
  llmOnlyRecall: number;
  rootCauseHitRate: number;
  actionabilityScore: number;
  dedupEffectiveness: number;
  findingCount: number;
  truePositives: number;
  falsePositives: number;
  missedIssues: number;
  tokenCount: number | null;
  latencyMs: number | null;
  diagnosticValue: number | null;
  matchDetails: MatchDetail[];
}

export interface MatchDetail {
  groundTruthId: string;
  matched: boolean;
  matchedFindingId: string | null;
  matchType: "exact-file-line" | "same-file-rule" | "same-domain-rule" | "unmatched";
}

// ─── Ground Truth Loader ────────────────────────────────────────────────────

export function loadGroundTruth(path: string): GroundTruth {
  const raw = readFileSync(resolve(path), "utf-8");
  return JSON.parse(raw) as GroundTruth;
}

// ─── Core Matching ──────────────────────────────────────────────────────────

/**
 * Match each ground truth issue to the closest audit finding.
 *
 * Matching tiers (in order of confidence):
 * 1. Exact: same file + line within ±5 lines
 * 2. Same file + overlapping rule/domain keywords
 * 3. Same domain + similar title (fuzzy)
 *
 * Each ground truth issue matches at most one finding.
 * Each finding can match at most one ground truth issue.
 */
export function matchFindings(
  groundTruth: GroundTruth,
  findings: AuditFinding[],
): MatchDetail[] {
  const usedFindings = new Set<string>();
  const results: MatchDetail[] = [];

  for (const gt of groundTruth.issues) {
    let bestMatch: { findingId: string; type: MatchDetail["matchType"] } | null = null;

    // Tier 1: exact file + line within ±5
    for (const f of findings) {
      if (usedFindings.has(f.id)) continue;
      for (const ev of f.evidence) {
        const normalizedEvFile = normalizePath(ev.file);
        const normalizedGtFile = normalizePath(gt.file);
        if (normalizedEvFile === normalizedGtFile && ev.line != null && Math.abs(ev.line - gt.line) <= 5) {
          bestMatch = { findingId: f.id, type: "exact-file-line" };
          break;
        }
      }
      if (bestMatch) break;
    }

    // Tier 2: same file + same domain
    if (!bestMatch) {
      for (const f of findings) {
        if (usedFindings.has(f.id)) continue;
        if (f.domain !== gt.domain) continue;
        for (const ev of f.evidence) {
          if (normalizePath(ev.file) === normalizePath(gt.file)) {
            bestMatch = { findingId: f.id, type: "same-file-rule" };
            break;
          }
        }
        if (bestMatch) break;
      }
    }

    // Tier 3: same domain + fuzzy title match
    if (!bestMatch) {
      for (const f of findings) {
        if (usedFindings.has(f.id)) continue;
        if (f.domain !== gt.domain) continue;
        if (fuzzyTitleMatch(gt.title, f.title)) {
          bestMatch = { findingId: f.id, type: "same-domain-rule" };
          break;
        }
      }
    }

    if (bestMatch) {
      usedFindings.add(bestMatch.findingId);
      results.push({ groundTruthId: gt.id, matched: true, matchedFindingId: bestMatch.findingId, matchType: bestMatch.type });
    } else {
      results.push({ groundTruthId: gt.id, matched: false, matchedFindingId: null, matchType: "unmatched" });
    }
  }

  return results;
}

// ─── Metric Computation ─────────────────────────────────────────────────────

export function computeMetrics(
  groundTruth: GroundTruth,
  auditOutput: AuditOutput,
): MetricResults {
  const matches = matchFindings(groundTruth, auditOutput.findings);

  const truePositives = matches.filter(m => m.matched).length;
  const missedIssues = matches.filter(m => !m.matched).length;
  const matchedFindingIds = new Set(matches.filter(m => m.matched).map(m => m.matchedFindingId));
  const falsePositives = auditOutput.findings.filter(f => !matchedFindingIds.has(f.id)).length;

  // Precision: TP / (TP + FP)
  const totalReported = auditOutput.findings.length;
  const precision = totalReported > 0 ? truePositives / totalReported : 0;

  // Recall: TP / total ground truth issues
  const totalGroundTruth = groundTruth.issues.length;
  const recall = totalGroundTruth > 0 ? truePositives / totalGroundTruth : 0;

  // Tool-only recall: among tool-detectable issues, how many were found?
  const toolDetectable = groundTruth.issues.filter(i => i.tool_detectable);
  const toolDetectedMatches = matches.filter(m => {
    const gt = groundTruth.issues.find(i => i.id === m.groundTruthId);
    return gt?.tool_detectable && m.matched;
  });
  const toolRecall = toolDetectable.length > 0 ? toolDetectedMatches.length / toolDetectable.length : 0;

  // LLM-only recall: among non-tool-detectable issues, how many were found?
  const llmOnly = groundTruth.issues.filter(i => !i.tool_detectable);
  const llmDetectedMatches = matches.filter(m => {
    const gt = groundTruth.issues.find(i => i.id === m.groundTruthId);
    return !gt?.tool_detectable && m.matched;
  });
  const llmOnlyRecall = llmOnly.length > 0 ? llmDetectedMatches.length / llmOnly.length : 0;

  // Root cause hit rate
  const rootCauseHitRate = computeRootCauseHitRate(groundTruth, auditOutput);

  // Actionability: average severity weight of matched findings (higher = more actionable)
  const actionabilityScore = computeActionability(groundTruth, matches);

  // Dedup effectiveness: 1 - (duplicate ratio)
  const dedupEffectiveness = computeDedupEffectiveness(auditOutput.findings);

  // Diagnostic value (if token count available)
  const tokenCount = auditOutput.token_count ?? null;
  const latencyMs = auditOutput.latency_ms ?? null;
  let diagnosticValue: number | null = null;
  if (tokenCount != null && tokenCount > 0) {
    const variance = 1 - dedupEffectiveness; // proxy for variance from dedup
    const denominator = (tokenCount / 10000) * Math.max(variance, 0.01);
    diagnosticValue = (precision * recall * actionabilityScore) / denominator;
  }

  return {
    fixture: auditOutput.fixture,
    tier: auditOutput.tier,
    precision: round(precision),
    recall: round(recall),
    toolRecall: round(toolRecall),
    llmOnlyRecall: round(llmOnlyRecall),
    rootCauseHitRate: round(rootCauseHitRate),
    actionabilityScore: round(actionabilityScore),
    dedupEffectiveness: round(dedupEffectiveness),
    findingCount: auditOutput.findings.length,
    truePositives,
    falsePositives,
    missedIssues,
    tokenCount,
    latencyMs,
    diagnosticValue: diagnosticValue != null ? round(diagnosticValue) : null,
    matchDetails: matches,
  };
}

// ─── Root Cause Hit Rate ────────────────────────────────────────────────────

/**
 * Measures what fraction of ground-truth root causes are surfaced
 * by the audit. A root cause is "hit" if the audit either:
 * - Explicitly lists it in root_causes_reported (by title match), OR
 * - Detects at least 2 of its symptoms
 */
function computeRootCauseHitRate(gt: GroundTruth, audit: AuditOutput): number {
  if (gt.root_causes.length === 0) return 1;

  const detectedIssueIds = new Set(audit.findings.map(f => f.id));
  // Also build a set of matched GT issue IDs from evidence
  const matchedGtIds = new Set<string>();
  const matches = matchFindings(gt, audit.findings);
  for (const m of matches) {
    if (m.matched) matchedGtIds.add(m.groundTruthId);
  }

  let hits = 0;
  for (const rc of gt.root_causes) {
    // Check explicit mention
    if (audit.root_causes_reported?.some(r => fuzzyTitleMatch(r.title, rc.title))) {
      hits++;
      continue;
    }

    // Check symptom coverage: at least 2 symptoms detected
    const detectedSymptoms = rc.symptoms.filter(s => matchedGtIds.has(s));
    if (detectedSymptoms.length >= 2) {
      hits++;
    }
  }

  return hits / gt.root_causes.length;
}

// ─── Actionability Score ────────────────────────────────────────────────────

/**
 * Weighted score based on which ground-truth issues were detected.
 * Higher-severity issues are worth more.
 * Returns a normalized 0-10 scale.
 */
function computeActionability(gt: GroundTruth, matches: MatchDetail[]): number {
  if (gt.issues.length === 0) return 0;

  let maxScore = 0;
  let achievedScore = 0;

  for (const issue of gt.issues) {
    const weight = SEVERITY_WEIGHTS[issue.severity] ?? 0;
    maxScore += weight;
    const match = matches.find(m => m.groundTruthId === issue.id);
    if (match?.matched) {
      achievedScore += weight;
    }
  }

  if (maxScore === 0) return 0;
  return (achievedScore / maxScore) * 10;
}

// ─── Dedup Effectiveness ────────────────────────────────────────────────────

/**
 * Estimates duplicate ratio among reported findings.
 * Two findings are considered duplicates if they:
 * - Share the same evidence file + line (±3 lines)
 * - OR share the same rule + file
 */
function computeDedupEffectiveness(findings: AuditFinding[]): number {
  if (findings.length <= 1) return 1;

  const duplicatePairs = new Set<string>();

  for (let i = 0; i < findings.length; i++) {
    for (let j = i + 1; j < findings.length; j++) {
      const a = findings[i];
      const b = findings[j];

      if (isDuplicate(a, b)) {
        duplicatePairs.add(`${i}-${j}`);
      }
    }
  }

  const duplicateCount = duplicatePairs.size;
  const totalPairs = (findings.length * (findings.length - 1)) / 2;
  const duplicateRatio = totalPairs > 0 ? duplicateCount / totalPairs : 0;

  return 1 - duplicateRatio;
}

function isDuplicate(a: AuditFinding, b: AuditFinding): boolean {
  for (const evA of a.evidence) {
    for (const evB of b.evidence) {
      const sameFile = normalizePath(evA.file) === normalizePath(evB.file);
      if (sameFile) {
        // Same file + close lines
        if (evA.line != null && evB.line != null && Math.abs(evA.line - evB.line) <= 3) {
          return true;
        }
        // Same file + same rule
        if (a.rule === b.rule) {
          return true;
        }
      }
    }
  }
  return false;
}

// ─── Multi-Run Aggregation ──────────────────────────────────────────────────

export interface AggregatedMetrics {
  fixture: string;
  tier: string;
  runs: number;
  precision: { mean: number; stddev: number };
  recall: { mean: number; stddev: number };
  toolRecall: { mean: number; stddev: number };
  rootCauseHitRate: { mean: number; stddev: number };
  actionabilityScore: { mean: number; stddev: number };
  dedupEffectiveness: { mean: number; stddev: number };
  diagnosticValue: { mean: number; stddev: number } | null;
  meanFindingCount: number;
  meanTokenCount: number | null;
  meanLatencyMs: number | null;
}

/**
 * Aggregate metrics from multiple runs of the same tier + fixture.
 * Computes mean and standard deviation for variance analysis.
 */
export function aggregateRuns(results: MetricResults[]): AggregatedMetrics {
  if (results.length === 0) throw new Error("Cannot aggregate zero results");

  const first = results[0];
  const fixture = first.fixture;
  const tier = first.tier;

  return {
    fixture,
    tier,
    runs: results.length,
    precision: stats(results.map(r => r.precision)),
    recall: stats(results.map(r => r.recall)),
    toolRecall: stats(results.map(r => r.toolRecall)),
    rootCauseHitRate: stats(results.map(r => r.rootCauseHitRate)),
    actionabilityScore: stats(results.map(r => r.actionabilityScore)),
    dedupEffectiveness: stats(results.map(r => r.dedupEffectiveness)),
    diagnosticValue: results.every(r => r.diagnosticValue != null)
      ? stats(results.map(r => r.diagnosticValue!))
      : null,
    meanFindingCount: mean(results.map(r => r.findingCount)),
    meanTokenCount: results.every(r => r.tokenCount != null)
      ? mean(results.map(r => r.tokenCount!))
      : null,
    meanLatencyMs: results.every(r => r.latencyMs != null)
      ? mean(results.map(r => r.latencyMs!))
      : null,
  };
}

// ─── Comparison Table ───────────────────────────────────────────────────────

/**
 * Generate a Markdown comparison table from aggregated results across tiers.
 */
export function generateComparisonTable(aggregated: AggregatedMetrics[]): string {
  const headers = [
    "Tier", "Fixture", "Precision", "Recall", "Tool Recall",
    "RC Hit Rate", "Actionability", "Dedup", "Findings", "Tokens", "DV",
  ];

  const rows = aggregated.map(a => [
    a.tier,
    a.fixture,
    fmtStat(a.precision),
    fmtStat(a.recall),
    fmtStat(a.toolRecall),
    fmtStat(a.rootCauseHitRate),
    fmtStat(a.actionabilityScore),
    fmtStat(a.dedupEffectiveness),
    String(Math.round(a.meanFindingCount)),
    a.meanTokenCount != null ? String(Math.round(a.meanTokenCount)) : "—",
    a.diagnosticValue != null ? fmtStat(a.diagnosticValue) : "—",
  ]);

  const separator = headers.map(() => "---");
  const lines = [
    `| ${headers.join(" | ")} |`,
    `| ${separator.join(" | ")} |`,
    ...rows.map(row => `| ${row.join(" | ")} |`),
  ];

  return lines.join("\n");
}

// ─── Missed Issues Report ───────────────────────────────────────────────────

/**
 * Generate a report listing issues that were missed by the audit,
 * grouped by root cause for diagnostic insight.
 */
export function generateMissedReport(groundTruth: GroundTruth, metrics: MetricResults): string {
  const missed = metrics.matchDetails.filter(m => !m.matched);
  if (missed.length === 0) return "All ground-truth issues were detected.";

  const lines: string[] = ["## Missed Issues\n"];

  // Group by root cause
  const byRootCause = new Map<string, MatchDetail[]>();
  for (const m of missed) {
    const gt = groundTruth.issues.find(i => i.id === m.groundTruthId);
    const rcKey = gt?.root_cause ?? "(no root cause)";
    if (!byRootCause.has(rcKey)) byRootCause.set(rcKey, []);
    byRootCause.get(rcKey)!.push(m);
  }

  for (const [rcId, missedItems] of byRootCause) {
    const rc = groundTruth.root_causes.find(r => r.id === rcId);
    const rcTitle = rc ? `${rc.id}: ${rc.title}` : rcId;
    lines.push(`### ${rcTitle}\n`);

    for (const m of missedItems) {
      const gt = groundTruth.issues.find(i => i.id === m.groundTruthId)!;
      const toolTag = gt.tool_detectable ? "🔧 tool-detectable" : "🧠 llm-only";
      lines.push(`- **${gt.id}** [${gt.severity}] ${gt.title} — ${gt.file}:${gt.line} (${toolTag})`);
    }
    lines.push("");
  }

  return lines.join("\n");
}

// ─── Helpers ────────────────────────────────────────────────────────────────

function normalizePath(p: string): string {
  return p.replace(/\\/g, "/").replace(/^\.\//, "").toLowerCase();
}

function fuzzyTitleMatch(a: string, b: string): boolean {
  const normalize = (s: string) => s.toLowerCase().replace(/[^a-z0-9]/g, " ").trim();
  const wordsA = new Set(normalize(a).split(/\s+/).filter(w => w.length > 2));
  const wordsB = new Set(normalize(b).split(/\s+/).filter(w => w.length > 2));
  if (wordsA.size === 0 || wordsB.size === 0) return false;
  const intersection = [...wordsA].filter(w => wordsB.has(w));
  const union = new Set([...wordsA, ...wordsB]);
  return intersection.length / union.size >= 0.4;
}

function round(n: number, decimals = 3): number {
  const factor = 10 ** decimals;
  return Math.round(n * factor) / factor;
}

function mean(values: number[]): number {
  if (values.length === 0) return 0;
  return values.reduce((a, b) => a + b, 0) / values.length;
}

function stddev(values: number[]): number {
  if (values.length < 2) return 0;
  const m = mean(values);
  const squaredDiffs = values.map(v => (v - m) ** 2);
  return Math.sqrt(squaredDiffs.reduce((a, b) => a + b, 0) / (values.length - 1));
}

function stats(values: number[]): { mean: number; stddev: number } {
  return { mean: round(mean(values)), stddev: round(stddev(values)) };
}

function fmtStat(s: { mean: number; stddev: number }): string {
  return s.stddev > 0 ? `${s.mean}±${s.stddev}` : String(s.mean);
}
