import { SEVERITY_RANK, type ConsolidatedReport, type Finding } from "../types.js";
import type { RootCauseCluster } from "../merger/root-cause.js";
import type { PrioritizedCluster, RemediationPlan } from "../merger/prioritize.js";
import { capitalize } from "../utils/strings.js";

const SEVERITY_ICONS: Record<string, string> = {
  critical: "🔴",
  high: "🟠",
  medium: "🟡",
  low: "🔵",
  info: "⚪",
};

/**
 * Renders a full consolidated audit report as Markdown.
 */
export function renderMarkdown(report: ConsolidatedReport): string {
  const reportWithDiagnostics = asReportWithDiagnostics(report);
  const lines: string[] = [];

  lines.push("# Inspectra Audit Report");
  lines.push("");

  lines.push(renderExecutiveDiagnosis(reportWithDiagnostics));
  lines.push(renderRemediationPlan(reportWithDiagnostics));
  lines.push(renderRootCauseAnalysis(reportWithDiagnostics));
  lines.push(renderDomainBreakdown(reportWithDiagnostics));
  lines.push(renderScoreContext(reportWithDiagnostics));
  lines.push(renderMetadata(report));

  return lines.join("\n");
}

interface ReportWithDiagnostics extends ConsolidatedReport {
  clusters?: RootCauseCluster[];
  remediation_plan?: RemediationPlan;
}

interface RemediationRow {
  batch: "fix_now" | "next_sprint" | "backlog";
  label: string;
  severity: string;
  effort: string;
  impact: number;
  scoreDelta: number;
  dependencies: string;
}

function asReportWithDiagnostics(report: ConsolidatedReport): ReportWithDiagnostics {
  return report as ReportWithDiagnostics;
}

function renderExecutiveDiagnosis(report: ReportWithDiagnostics): string {
  const plan = report.remediation_plan;
  const currentScore = plan?.current_score ?? report.overall_score;
  const projectedFixNowScore =
    plan?.score_after_fix_now ?? estimateFallbackFixNowScore(report.overall_score, report.statistics?.by_severity);

  const rootCauses = getTopRootCauses(report);
  const rootCauseSentence =
    rootCauses.length > 0
      ? `The highest-leverage root causes are ${joinAsList(rootCauses.map(formatRootCauseLabel))}.`
      : "No dominant systemic root cause was inferred from the available data.";

  const firstAction = getFirstAction(report, plan);

  const lines: string[] = [];
  lines.push("## Executive Diagnosis");
  lines.push("");
  lines.push(`1. ${rootCauseSentence}`);
  lines.push(`2. If the Fix Now batch is completed, the score is expected to move from ${currentScore}/100 to ~${projectedFixNowScore}/100.`);
  lines.push(`3. First action: ${firstAction}.`);
  lines.push("");

  return lines.join("\n");
}

function renderRemediationPlan(report: ReportWithDiagnostics): string {
  const rows = buildRemediationRows(report);

  const lines: string[] = [];
  lines.push("## Remediation Plan");
  lines.push("");
  lines.push("| Batch | Root Cause | Severity | Effort | Impact | Est. Score Delta | Dependencies |");
  lines.push("| -------- | ----------- | ---------- | -------- | -------- | ---------------- | ------------ |");

  if (rows.length === 0) {
    lines.push("| backlog | No remediation clusters available | - | - | 0 | +0 | Not enough data |");
    lines.push("");
    return lines.join("\n");
  }

  for (const row of rows) {
    lines.push(
      `| ${formatBatchLabel(row.batch)} | ${row.label} | ${capitalize(row.severity)} | ${row.effort} | ${row.impact} | +${row.scoreDelta} | ${row.dependencies} |`,
    );
  }

  lines.push("");
  return lines.join("\n");
}

function renderRootCauseAnalysis(report: ReportWithDiagnostics): string {
  const clusters = getClusters(report);

  const lines: string[] = [];
  lines.push("## Root Cause Analysis");
  lines.push("");

  if (clusters.length === 0) {
    lines.push("No root-cause clusters were provided; analysis is inferred from top findings only.");
    lines.push("");
    for (const finding of report.top_findings.slice(0, 3)) {
      lines.push(`- **${finding.id}** ${finding.title}: ${finding.recommendation ?? "Review this finding first."}`);
    }
    lines.push("");
    return lines.join("\n");
  }

  for (const cluster of clusters) {
    const contributingIds = uniqueFindingIds(cluster).slice(0, 4).join(", ");
    lines.push(`### ${formatRootCauseLabel(cluster.category)} (${capitalize(cluster.severity_ceiling)})`);
    lines.push("");
    lines.push(`- **Hypothesis:** ${cluster.rationale}`);
    lines.push(
      `- **Blast Radius:** ${cluster.finding_count} findings, ${cluster.hotspot_count} hotspots, ${cluster.domain_count} domains (${cluster.domains.join(", ")})`,
    );
    lines.push(`- **Contributing Findings:** ${contributingIds || "Not listed"}`);
    lines.push("");
  }

  const causalArrows = buildCausalArrows(clusters);
  if (causalArrows.length > 0) {
    lines.push("### Causal Arrows");
    lines.push("");
    for (const arrow of causalArrows) {
      lines.push(`- ${arrow}`);
    }
    lines.push("");
  }

  return lines.join("\n");
}

function renderDomainBreakdown(report: ReportWithDiagnostics): string {
  const lines: string[] = [];
  lines.push("## Domain Breakdown");
  lines.push("");
  lines.push("| Domain | Score | Findings | Summary |");
  lines.push("| -------- | ------- | ---------- | --------- |");

  for (const dr of report.domain_reports) {
    const findingCount = dr.findings.length;
    const bar = renderScoreBar(dr.score);
    lines.push(`| ${capitalize(dr.domain)} | ${bar} ${dr.score}/100 | ${findingCount} | ${dr.summary} |`);
  }

  lines.push("");

  for (const dr of report.domain_reports) {
    lines.push(`### ${capitalize(dr.domain)} (${dr.score}/100)`);
    lines.push("");

    if (dr.findings.length === 0) {
      lines.push("_No findings — clean!_");
      lines.push("");
      continue;
    }

    const grouped = groupBySeverity(dr.findings);
    for (const [severity, findings] of grouped) {
      const icon = SEVERITY_ICONS[severity] ?? "⚪";
      lines.push(`#### ${icon} ${capitalize(severity)} (${findings.length})`);
      lines.push("");

      for (const f of findings) {
        const location = f.evidence?.[0]?.file ?? "";
        const line = f.evidence?.[0]?.line ? `:${f.evidence[0].line}` : "";
        lines.push(`- **${f.id}** ${f.title} — \`${location}${line}\``);
        if (f.recommendation) {
          lines.push(`  - Fix: ${f.recommendation}`);
        }
      }
      lines.push("");
    }
  }

  return lines.join("\n");
}

function renderScoreContext(report: ReportWithDiagnostics): string {
  const lines: string[] = [];
  lines.push("## Score Context");
  lines.push("");
  lines.push("This score captures weighted risk across audited domains and prioritizes confidence-adjusted findings.");
  lines.push("It does not capture runtime-only failures, production traffic patterns, or unscanned proprietary dependencies.");
  lines.push(
    `Use ${report.remediation_plan ? "the remediation batches above" : "the top findings and domain breakdown"} as the operational plan, and treat the numeric score as a directional KPI rather than a release gate.`,
  );
  lines.push("");
  return lines.join("\n");
}

function buildRemediationRows(report: ReportWithDiagnostics): RemediationRow[] {
  if (report.remediation_plan) {
    return [
      ...toRows(report.remediation_plan.fix_now, "fix_now"),
      ...toRows(report.remediation_plan.next_sprint, "next_sprint"),
      ...toRows(report.remediation_plan.backlog, "backlog"),
    ];
  }

  return report.top_findings.slice(0, 6).map((finding) => {
    const batch = inferBatchFromSeverity(finding.severity);
    const impact = inferImpactFromSeverity(finding.severity);
    const scoreDelta = inferScoreDeltaFromSeverity(finding.severity);
    return {
      batch,
      label: finding.title,
      severity: finding.severity,
      effort: finding.effort ?? "unknown",
      impact,
      scoreDelta,
      dependencies: inferDependencyHint(batch, finding.domain),
    };
  });
}

function toRows(items: ReadonlyArray<PrioritizedCluster>, batch: RemediationRow["batch"]): RemediationRow[] {
  return items.map((item) => ({
    batch,
    label: formatRootCauseLabel(item.cluster.category),
    severity: item.cluster.severity_ceiling,
    effort: item.effort,
    impact: item.impact_score,
    scoreDelta: item.estimated_score_delta,
    dependencies: inferDependencyHint(batch, item.cluster.domains[0] ?? ""),
  }));
}

function getClusters(report: ReportWithDiagnostics): RootCauseCluster[] {
  if (report.clusters && report.clusters.length > 0) {
    return report.clusters;
  }

  if (!report.remediation_plan) {
    return [];
  }

  const merged = [
    ...report.remediation_plan.fix_now,
    ...report.remediation_plan.next_sprint,
    ...report.remediation_plan.backlog,
  ].map((item) => item.cluster);

  return dedupeClusters(merged);
}

function dedupeClusters(clusters: ReadonlyArray<RootCauseCluster>): RootCauseCluster[] {
  const seen = new Set<string>();
  const deduped: RootCauseCluster[] = [];
  for (const cluster of clusters) {
    const key = `${cluster.category}:${cluster.rationale}`;
    if (seen.has(key)) continue;
    seen.add(key);
    deduped.push(cluster);
  }
  return deduped;
}

function getTopRootCauses(report: ReportWithDiagnostics): string[] {
  const fromPlan = report.remediation_plan?.fix_now.map((item) => item.cluster.category) ?? [];
  if (fromPlan.length > 0) {
    return uniqueStrings(fromPlan).slice(0, 3);
  }

  const fromClusters = getClusters(report).map((cluster) => cluster.category);
  if (fromClusters.length > 0) {
    return uniqueStrings(fromClusters).slice(0, 3);
  }

  return report.top_findings.slice(0, 3).map((finding) => finding.title);
}

function getFirstAction(report: ReportWithDiagnostics, plan?: RemediationPlan): string {
  const topFixNow = plan?.fix_now[0];
  if (topFixNow) {
    return `Resolve ${formatRootCauseLabel(topFixNow.cluster.category)} (${topFixNow.effort} effort, +${topFixNow.estimated_score_delta} points estimated)`;
  }

  const topFinding = report.top_findings[0];
  if (!topFinding) {
    return "Validate low-risk domains and monitor trend over time";
  }

  return topFinding.recommendation ?? `Address ${topFinding.id} (${topFinding.title})`;
}

function estimateFallbackFixNowScore(
  overallScore: number,
  severities?: { critical: number; high: number; medium: number; low: number; info: number },
): number {
  if (!severities) return Math.min(100, overallScore + 5);
  const estimatedDelta = severities.critical * 4 + severities.high * 2 + severities.medium * 1;
  return Math.min(100, Math.round((overallScore + estimatedDelta) * 10) / 10);
}

function uniqueFindingIds(cluster: RootCauseCluster): string[] {
  const ids = cluster.hotspots.flatMap((hotspot) => hotspot.findings.map((finding) => finding.id));
  return uniqueStrings(ids);
}

function buildCausalArrows(clusters: ReadonlyArray<RootCauseCluster>): string[] {
  if (clusters.length < 2) return [];

  const sorted = [...clusters].sort((a, b) => {
    const severityDiff = SEVERITY_RANK[b.severity_ceiling] - SEVERITY_RANK[a.severity_ceiling];
    if (severityDiff !== 0) return severityDiff;
    return b.finding_count - a.finding_count;
  });

  const arrows: string[] = [];
  for (let index = 0; index < sorted.length - 1; index += 1) {
    const current = sorted[index];
    const next = sorted[index + 1];
    if (!current || !next) continue;
    arrows.push(
      `${formatRootCauseLabel(current.category)} → ${formatRootCauseLabel(next.category)} (sequence by severity and blast radius).`,
    );
  }
  return arrows.slice(0, 2);
}

function formatBatchLabel(batch: RemediationRow["batch"]): string {
  if (batch === "fix_now") return "Fix Now";
  if (batch === "next_sprint") return "Next Sprint";
  return "Backlog";
}

function formatRootCauseLabel(label: string): string {
  return label.split("-").map(capitalize).join(" ");
}

function inferBatchFromSeverity(severity: Finding["severity"]): RemediationRow["batch"] {
  if (severity === "critical") return "fix_now";
  if (severity === "high") return "next_sprint";
  return "backlog";
}

function inferImpactFromSeverity(severity: Finding["severity"]): number {
  const map: Record<Finding["severity"], number> = {
    critical: 90,
    high: 70,
    medium: 40,
    low: 20,
    info: 10,
  };
  return map[severity];
}

function inferScoreDeltaFromSeverity(severity: Finding["severity"]): number {
  const map: Record<Finding["severity"], number> = {
    critical: 4,
    high: 2,
    medium: 1,
    low: 0.5,
    info: 0.2,
  };
  return map[severity];
}

function inferDependencyHint(batch: RemediationRow["batch"], primaryDomain: string): string {
  if (batch === "fix_now") {
    return "None detected";
  }
  if (primaryDomain === "security") {
    return "After security hardening in Fix Now";
  }
  if (batch === "backlog") {
    return "After Fix Now and Next Sprint";
  }
  return "After Fix Now batch";
}

function joinAsList(items: ReadonlyArray<string>): string {
  if (items.length <= 1) return items[0] ?? "";
  if (items.length === 2) return `${items[0]} and ${items[1]}`;
  const head = items.slice(0, -1).join(", ");
  const tail = items[items.length - 1];
  return `${head}, and ${tail}`;
}

function uniqueStrings(items: ReadonlyArray<string>): string[] {
  return Array.from(new Set(items));
}

function renderMetadata(report: ConsolidatedReport): string {
  const { metadata } = report;
  const lines: string[] = [];
  lines.push("---");
  lines.push("");
  lines.push(`_Generated by Inspectra on ${metadata.timestamp}_`);
  lines.push(`_Target: ${metadata.target} | Profile: ${metadata.profile}_`);
  if (metadata.domains_audited?.length) {
    lines.push(`_Domains: ${metadata.domains_audited.join(", ")}_`);
  }
  if (metadata.duration_ms) {
    lines.push(`_Duration: ${(metadata.duration_ms / 1000).toFixed(1)}s_`);
  }
  lines.push("");

  return lines.join("\n");
}

/**
 * Renders a standalone list of findings as Markdown, suitable for tool responses.
 * Unlike renderMarkdown, this does not require a full ConsolidatedReport.
 */
export function renderFindingsAsMarkdown(findings: Finding[]): string {
  if (findings.length === 0) {
    return "No findings detected.";
  }

  const lines: string[] = [];
  lines.push(`**${findings.length} finding(s)**`);
  lines.push("");

  const grouped = groupBySeverity(findings);
  for (const [severity, group] of grouped) {
    const icon = SEVERITY_ICONS[severity] ?? "⚪";
    lines.push(`### ${icon} ${capitalize(severity)} (${group.length})`);
    lines.push("");

    for (const f of group) {
      const location = f.evidence?.[0]
        ? `\`${f.evidence[0].file}${f.evidence[0].line ? `:${f.evidence[0].line}` : ""}\``
        : "_no location_";
      lines.push(`- **${f.id}** ${f.title} — ${location}`);
      if (f.description) {
        lines.push(`  - ${f.description}`);
      }
      if (f.recommendation) {
        lines.push(`  - **Fix:** ${f.recommendation}`);
      }
    }
    lines.push("");
  }

  return lines.join("\n");
}

function renderScoreBar(score: number): string {
  const filled = Math.round(score / 10);
  return "█".repeat(filled) + "░".repeat(10 - filled);
}

function groupBySeverity(findings: Finding[]): [string, Finding[]][] {
  const order = ["critical", "high", "medium", "low", "info"];
  const map = new Map<string, Finding[]>();

  for (const f of findings) {
    const list = map.get(f.severity) ?? [];
    list.push(f);
    map.set(f.severity, list);
  }

  return order.filter((s) => map.has(s)).map((s) => [s, map.get(s) ?? []]);
}
