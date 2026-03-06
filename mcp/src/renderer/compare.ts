import { type ConsolidatedReport, type Finding, type DomainReport } from "../types.js";
import { capitalize } from "../utils/strings.js";
import { diffReportFindings } from "../utils/findings.js";

// ─── Types ───────────────────────────────────────────────────────────────────

type DomainComparison = {
  domain: string;
  scoreA: number;
  scoreB: number;
  delta: number;
  findingsA: number;
  findingsB: number;
};

export type ComparisonResult = {
  reportA: { label: string; score: number; grade: string; findings: number };
  reportB: { label: string; score: number; grade: string; findings: number };
  overallDelta: number;
  domains: DomainComparison[];
  added: Finding[];
  removed: Finding[];
  unchanged: Finding[];
};

// ─── Core Comparison ─────────────────────────────────────────────────────────

export function compareReports(
  reportA: ConsolidatedReport,
  reportB: ConsolidatedReport,
  labelA = "Report A",
  labelB = "Report B",
): ComparisonResult {
  const domains = compareDomains(reportA.domain_reports, reportB.domain_reports);
  const { added, removed, unchanged } = diffReportFindings(reportA, reportB);

  return {
    reportA: {
      label: labelA,
      score: reportA.overall_score,
      grade: reportA.grade,
      findings: reportA.statistics?.total_findings ?? 0,
    },
    reportB: {
      label: labelB,
      score: reportB.overall_score,
      grade: reportB.grade,
      findings: reportB.statistics?.total_findings ?? 0,
    },
    overallDelta: reportA.overall_score - reportB.overall_score,
    domains,
    added,
    removed,
    unchanged,
  };
}

function compareDomains(
  reportsA: ReadonlyArray<DomainReport>,
  reportsB: ReadonlyArray<DomainReport>,
): DomainComparison[] {
  const allDomains = new Set([...reportsA.map((r) => r.domain), ...reportsB.map((r) => r.domain)]);
  const mapA = new Map(reportsA.map((r) => [r.domain, r]));
  const mapB = new Map(reportsB.map((r) => [r.domain, r]));

  return [...allDomains].map((domain) => {
    const a = mapA.get(domain);
    const b = mapB.get(domain);
    return {
      domain,
      scoreA: a?.score ?? 100,
      scoreB: b?.score ?? 100,
      delta: (a?.score ?? 100) - (b?.score ?? 100),
      findingsA: a?.findings.length ?? 0,
      findingsB: b?.findings.length ?? 0,
    };
  });
}

// ─── Markdown Rendering ──────────────────────────────────────────────────────

const SEVERITY_ICONS: Record<string, string> = {
  critical: "🔴",
  high: "🟠",
  medium: "🟡",
  low: "🔵",
  info: "⚪",
};

export function renderComparisonMarkdown(result: ComparisonResult): string {
  const lines: string[] = [];

  lines.push("## Audit Comparison");
  lines.push("");
  lines.push(renderSummaryTable(result));
  lines.push(renderDomainComparisonTable(result.domains));
  lines.push(renderAddedFindings(result.added));
  lines.push(renderRemovedFindings(result.removed));
  lines.push(renderUnchangedSummary(result.unchanged));

  return lines.join("\n");
}

function renderSummaryTable(result: ComparisonResult): string {
  const { reportA, reportB, overallDelta } = result;
  const arrow = overallDelta > 0 ? "▲" : overallDelta < 0 ? "▼" : "—";
  const sign = overallDelta > 0 ? "+" : "";

  return [
    `| | ${reportA.label} | ${reportB.label} | Delta |`,
    `| --- | --- | --- | --- |`,
    `| **Score** | ${reportA.score}/100 | ${reportB.score}/100 | ${arrow} ${sign}${overallDelta} |`,
    `| **Grade** | ${reportA.grade} | ${reportB.grade} | |`,
    `| **Findings** | ${reportA.findings} | ${reportB.findings} | ${sign}${reportA.findings - reportB.findings} |`,
    "",
  ].join("\n");
}

function renderDomainComparisonTable(domains: ReadonlyArray<DomainComparison>): string {
  const lines = [
    "### Domain Comparison",
    "",
    "| Domain | Score A | Score B | Delta | Findings A | Findings B |",
    "| -------- | --------- | --------- | ------- | ------------ | ------------ |",
  ];

  for (const d of domains) {
    const sign = d.delta > 0 ? "+" : "";
    const arrow = d.delta > 0 ? "▲" : d.delta < 0 ? "▼" : "—";
    lines.push(
      `| ${capitalize(d.domain)} | ${d.scoreA} | ${d.scoreB} | ${arrow} ${sign}${d.delta} | ${d.findingsA} | ${d.findingsB} |`,
    );
  }

  lines.push("");
  return lines.join("\n");
}

function renderAddedFindings(findings: ReadonlyArray<Finding>): string {
  if (findings.length === 0) return "### Added Findings\n\n_None_\n";

  const lines = [`### Added Findings (${findings.length})`, ""];
  for (const f of findings.slice(0, 20)) {
    const icon = SEVERITY_ICONS[f.severity] ?? "⚪";
    lines.push(`- ${icon} **${f.id}** ${f.title}`);
  }
  if (findings.length > 20) {
    lines.push(`- _...and ${findings.length - 20} more_`);
  }
  lines.push("");
  return lines.join("\n");
}

function renderRemovedFindings(findings: ReadonlyArray<Finding>): string {
  if (findings.length === 0) return "### Removed Findings\n\n_None_\n";

  const lines = [`### Removed Findings (${findings.length})`, ""];
  for (const f of findings.slice(0, 20)) {
    lines.push(`- ~~${f.id} ${f.title}~~`);
  }
  if (findings.length > 20) {
    lines.push(`- _...and ${findings.length - 20} more_`);
  }
  lines.push("");
  return lines.join("\n");
}

function renderUnchangedSummary(findings: ReadonlyArray<Finding>): string {
  if (findings.length === 0) return "";
  return `### Unchanged Findings\n\n${findings.length} finding(s) present in both reports.\n`;
}
