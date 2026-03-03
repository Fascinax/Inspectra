import type { ConsolidatedReport, Grade } from "../types.js";

// ─── Types ───────────────────────────────────────────────────────────────────

export type TrendEntry = {
  timestamp: string;
  overall_score: number;
  grade: Grade;
  total_findings: number;
  domain_scores: Record<string, number>;
};

export type TrendData = {
  entries: TrendEntry[];
  direction: "improving" | "declining" | "stable";
  averageScore: number;
  bestScore: number;
  worstScore: number;
  scoreChange: number;
};

// ─── Trend Computation ───────────────────────────────────────────────────────

export function buildTrendEntry(report: ConsolidatedReport): TrendEntry {
  const domainScores: Record<string, number> = {};
  for (const dr of report.domain_reports) {
    domainScores[dr.domain] = dr.score;
  }

  return {
    timestamp: report.metadata.timestamp,
    overall_score: report.overall_score,
    grade: report.grade,
    total_findings: report.statistics?.total_findings ?? 0,
    domain_scores: domainScores,
  };
}

export function analyzeTrend(entries: ReadonlyArray<TrendEntry>): TrendData {
  if (entries.length === 0) {
    return {
      entries: [],
      direction: "stable",
      averageScore: 0,
      bestScore: 0,
      worstScore: 0,
      scoreChange: 0,
    };
  }

  const sorted = [...entries].sort((a, b) => a.timestamp.localeCompare(b.timestamp));
  const scores = sorted.map((e) => e.overall_score);

  const averageScore = Math.round(scores.reduce((sum, s) => sum + s, 0) / scores.length);
  const bestScore = Math.max(...scores);
  const worstScore = Math.min(...scores);

  const first = scores[0] ?? 0;
  const last = scores[scores.length - 1] ?? 0;
  const scoreChange = last - first;

  const direction = determineDirection(scores);

  return {
    entries: sorted,
    direction,
    averageScore,
    bestScore,
    worstScore,
    scoreChange,
  };
}

function determineDirection(scores: ReadonlyArray<number>): TrendData["direction"] {
  if (scores.length < 2) return "stable";

  const recentWindow = scores.slice(-3);
  const avg = recentWindow.reduce((s, v) => s + v, 0) / recentWindow.length;
  const first = scores[0] ?? 0;

  if (avg - first > 3) return "improving";
  if (first - avg > 3) return "declining";
  return "stable";
}

// ─── Trend Rendering (Markdown) ──────────────────────────────────────────────

export function renderTrendMarkdown(trend: TrendData): string {
  if (trend.entries.length === 0) return "No trend data available.";

  const directionIcon =
    trend.direction === "improving" ? "📈" : trend.direction === "declining" ? "📉" : "➡️";

  const lines: string[] = [];
  lines.push("## Score Trend");
  lines.push("");
  lines.push(`| Metric | Value |`);
  lines.push(`|--------|-------|`);
  lines.push(`| Direction | ${directionIcon} ${capitalize(trend.direction)} |`);
  lines.push(`| Average | ${trend.averageScore}/100 |`);
  lines.push(`| Best | ${trend.bestScore}/100 |`);
  lines.push(`| Worst | ${trend.worstScore}/100 |`);
  lines.push(`| Change | ${trend.scoreChange > 0 ? "+" : ""}${trend.scoreChange} |`);
  lines.push(`| Data Points | ${trend.entries.length} |`);
  lines.push("");

  lines.push("### History");
  lines.push("");
  lines.push("| Date | Score | Grade | Findings |");
  lines.push("|------|-------|-------|----------|");

  for (const entry of trend.entries.slice(-10)) {
    const date = entry.timestamp.split("T")[0] ?? entry.timestamp;
    const bar = renderMiniBar(entry.overall_score);
    lines.push(`| ${date} | ${bar} ${entry.overall_score} | ${entry.grade} | ${entry.total_findings} |`);
  }
  lines.push("");

  return lines.join("\n");
}

function renderMiniBar(score: number): string {
  const filled = Math.round(score / 10);
  return "█".repeat(filled) + "░".repeat(10 - filled);
}

function capitalize(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
}
