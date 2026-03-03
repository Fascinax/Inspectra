import { type ConsolidatedReport, type Finding, type DomainReport } from "../types.js";
import { diffReportFindings } from "../utils/findings.js";
import { capitalize } from "../utils/strings.js";

// ─── Types ───────────────────────────────────────────────────────────────────

type DomainDelta = {
  domain: string;
  current: number;
  baseline: number;
  delta: number;
  trend: "improved" | "degraded" | "unchanged";
};

type MergeDecision = {
  allowed: boolean;
  reason: string;
  criticalCount: number;
  highCount: number;
};

export type PrDelta = {
  overallDelta: number;
  currentScore: number;
  baselineScore: number;
  currentGrade: string;
  baselineGrade: string;
  domainDeltas: DomainDelta[];
  newFindings: Finding[];
  fixedFindings: Finding[];
  mergeDecision: MergeDecision;
};

export type InlineAnnotation = {
  path: string;
  line: number;
  severity: string;
  body: string;
};

// ─── Delta Computation ───────────────────────────────────────────────────────

export function computePrDelta(current: ConsolidatedReport, baseline: ConsolidatedReport): PrDelta {
  const domainDeltas = computeDomainDeltas(current.domain_reports, baseline.domain_reports);
  const { added: newFindings, removed: fixedFindings } = diffReportFindings(current, baseline);
  const mergeDecision = decideMerge(newFindings, current);

  return {
    overallDelta: current.overall_score - baseline.overall_score,
    currentScore: current.overall_score,
    baselineScore: baseline.overall_score,
    currentGrade: current.grade,
    baselineGrade: baseline.grade,
    domainDeltas,
    newFindings,
    fixedFindings,
    mergeDecision,
  };
}

function computeDomainDeltas(
  currentReports: ReadonlyArray<DomainReport>,
  baselineReports: ReadonlyArray<DomainReport>,
): DomainDelta[] {
  const baselineByDomain = new Map(baselineReports.map((r) => [r.domain, r.score]));

  return currentReports.map((report) => {
    const baselineScore = baselineByDomain.get(report.domain) ?? 100;
    const delta = report.score - baselineScore;
    const trend = delta > 0 ? "improved" : delta < 0 ? "degraded" : "unchanged";
    return { domain: report.domain, current: report.score, baseline: baselineScore, delta, trend };
  });
}

// ─── Merge Decision ──────────────────────────────────────────────────────────

function decideMerge(newFindings: ReadonlyArray<Finding>, current: ConsolidatedReport): MergeDecision {
  const allFindings = current.domain_reports.flatMap((r) => r.findings);
  const criticalCount = allFindings.filter((f) => f.severity === "critical").length;
  const highCount = allFindings.filter((f) => f.severity === "high").length;

  if (criticalCount > 0) {
    return {
      allowed: false,
      reason: `${criticalCount} critical finding(s) must be resolved before merge`,
      criticalCount,
      highCount,
    };
  }

  const newHighCount = newFindings.filter((f) => f.severity === "high").length;
  if (newHighCount >= 3) {
    return {
      allowed: false,
      reason: `${newHighCount} new high-severity findings introduced in this PR`,
      criticalCount,
      highCount,
    };
  }

  return {
    allowed: true,
    reason: "No blocking findings — merge allowed",
    criticalCount,
    highCount,
  };
}

// ─── PR Comment Rendering ────────────────────────────────────────────────────

const SEVERITY_ICONS: Record<string, string> = {
  critical: "🔴",
  high: "🟠",
  medium: "🟡",
  low: "🔵",
  info: "⚪",
};

const TREND_ICONS: Record<string, string> = {
  improved: "🟢",
  degraded: "🔴",
  unchanged: "⚪",
};

export function renderPrComment(delta: PrDelta): string {
  const lines: string[] = [];

  lines.push(renderCommentHeader(delta));
  lines.push(renderDomainDeltaTable(delta.domainDeltas));
  lines.push(renderNewFindings(delta.newFindings));
  lines.push(renderFixedFindings(delta.fixedFindings));
  lines.push(renderMergeDecision(delta.mergeDecision));
  lines.push(renderCommentFooter());

  return lines.join("\n");
}

function renderCommentHeader(delta: PrDelta): string {
  const arrow = delta.overallDelta > 0 ? "▲" : delta.overallDelta < 0 ? "▼" : "—";
  const sign = delta.overallDelta > 0 ? "+" : "";

  const lines = [
    "## 🔍 Inspectra Audit Report",
    "",
    `| Metric | Value |`,
    `|--------|-------|`,
    `| **Score** | **${delta.currentScore}/100** (Grade **${delta.currentGrade}**) |`,
    `| **Delta vs main** | ${arrow} ${sign}${delta.overallDelta} (was ${delta.baselineScore}, Grade ${delta.baselineGrade}) |`,
    `| **New findings** | ${delta.newFindings.length} |`,
    `| **Fixed findings** | ${delta.fixedFindings.length} |`,
    "",
  ];
  return lines.join("\n");
}

function renderDomainDeltaTable(deltas: ReadonlyArray<DomainDelta>): string {
  const lines = [
    "### Domain Breakdown",
    "",
    "| Domain | Score | Delta | Trend |",
    "|--------|-------|-------|-------|",
  ];

  for (const d of deltas) {
    const sign = d.delta > 0 ? "+" : "";
    const arrow = d.delta > 0 ? "▲" : d.delta < 0 ? "▼" : "—";
    const icon = TREND_ICONS[d.trend] ?? "⚪";
    lines.push(`| ${capitalize(d.domain)} | ${d.current}/100 | ${arrow} ${sign}${d.delta} | ${icon} |`);
  }

  lines.push("");
  return lines.join("\n");
}

function renderNewFindings(findings: ReadonlyArray<Finding>): string {
  if (findings.length === 0) return "### ✅ No New Findings\n";

  const lines = [`### ⚠️ New Findings (${findings.length})`, ""];
  for (const f of findings.slice(0, 15)) {
    const icon = SEVERITY_ICONS[f.severity] ?? "⚪";
    const loc = f.evidence?.[0] ? ` — \`${f.evidence[0].file}\`` : "";
    lines.push(`- ${icon} **${f.id}** ${f.title}${loc}`);
  }
  if (findings.length > 15) {
    lines.push(`- _...and ${findings.length - 15} more_`);
  }
  lines.push("");
  return lines.join("\n");
}

function renderFixedFindings(findings: ReadonlyArray<Finding>): string {
  if (findings.length === 0) return "";

  const lines = [`### 🎉 Fixed Findings (${findings.length})`, ""];
  for (const f of findings.slice(0, 10)) {
    lines.push(`- ~~${f.id} ${f.title}~~`);
  }
  if (findings.length > 10) {
    lines.push(`- _...and ${findings.length - 10} more_`);
  }
  lines.push("");
  return lines.join("\n");
}

function renderMergeDecision(decision: MergeDecision): string {
  const icon = decision.allowed ? "✅" : "❌";
  return [`### ${icon} Merge Decision`, "", `**${decision.reason}**`, ""].join("\n");
}

function renderCommentFooter(): string {
  return [
    "---",
    "",
    "_Generated by [Inspectra](https://github.com/Fascinax/Inspectra) — multi-agent code audit_",
    "",
  ].join("\n");
}

// ─── Inline Annotations ─────────────────────────────────────────────────────

export function extractInlineAnnotations(findings: ReadonlyArray<Finding>): InlineAnnotation[] {
  const annotations: InlineAnnotation[] = [];

  for (const f of findings) {
    if (!f.evidence || f.evidence.length === 0) continue;

    const primary = f.evidence[0];
    if (!primary || !primary.line) continue;

    const body = formatAnnotationBody(f);
    annotations.push({
      path: primary.file,
      line: primary.line,
      severity: f.severity,
      body,
    });
  }

  return annotations;
}

function formatAnnotationBody(finding: Finding): string {
  const icon = SEVERITY_ICONS[finding.severity] ?? "⚪";
  const parts = [`${icon} **${finding.id}** — ${finding.title}`];
  if (finding.description) {
    parts.push(`\n> ${finding.description}`);
  }
  if (finding.recommendation) {
    parts.push(`\n**Fix:** ${finding.recommendation}`);
  }
  return parts.join("");
}

// ─── Utilities ───────────────────────────────────────────────────────────────
