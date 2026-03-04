import Handlebars from "handlebars";
import type { ConsolidatedReport, Finding } from "../types.js";
import { capitalize } from "../utils/strings.js";
import { renderStyles } from "./html-styles.js";
import { REPORT_TEMPLATE, FINDING_PARTIAL } from "./html-template.js";

// ─── HTML Report Renderer ────────────────────────────────────────────────────
// Produces a self-contained HTML file with embedded CSS and inline SVG charts.
// Uses Handlebars for auto-escaping and separation of template from logic.

const SEVERITY_COLORS: Record<string, string> = {
  critical: "#ef4444",
  high: "#f97316",
  medium: "#eab308",
  low: "#3b82f6",
  info: "#6b7280",
};

const SEVERITY_LABELS: Record<string, string> = {
  critical: "Critical",
  high: "High",
  medium: "Medium",
  low: "Low",
  info: "Info",
};

const GRADE_COLORS: Record<string, string> = {
  A: "#22c55e",
  B: "#84cc16",
  C: "#eab308",
  D: "#f97316",
  F: "#ef4444",
};

Handlebars.registerPartial("findingCard", FINDING_PARTIAL);
const compiledTemplate = Handlebars.compile(REPORT_TEMPLATE);

export function renderHtml(report: ConsolidatedReport): string {
  const context = buildContext(report);
  return compiledTemplate(context);
}

// ─── View Model ──────────────────────────────────────────────────────────────

type SeverityKey = "critical" | "high" | "medium" | "low" | "info";

function buildContext(report: ConsolidatedReport) {
  const circumference = 2 * Math.PI * 58;
  const offset = circumference - (report.overall_score / 100) * circumference;

  const sev = report.statistics?.by_severity;
  const severityKeys: SeverityKey[] = ["critical", "high", "medium", "low", "info"];
  const maxSev = sev ? Math.max(...severityKeys.map((k) => sev[k] ?? 0), 1) : 1;

  const severities = sev
    ? severityKeys.map((key) => {
        const count = sev[key] ?? 0;
        const pct = (count / maxSev) * 100;
        return {
          key,
          label: SEVERITY_LABELS[key] ?? key,
          color: SEVERITY_COLORS[key] ?? "#6b7280",
          count,
          pct: Math.max(pct, count > 0 ? 8 : 0),
        };
      })
    : [];

  return {
    metadata: report.metadata,
    overall_score: report.overall_score,
    grade: report.grade,
    stylesHtml: new Handlebars.SafeString(renderStyles()),
    circumference,
    offset,
    gradeColor: GRADE_COLORS[report.grade] ?? "#6b7280",
    totalFindings: report.statistics?.total_findings ?? 0,
    domainCount: report.domain_reports.length,
    hasDuration: !!report.metadata.duration_ms,
    durationSeconds: report.metadata.duration_ms ? (report.metadata.duration_ms / 1000).toFixed(1) : null,
    hasSeverityData: !!sev,
    severities,
    hasTopFindings: report.top_findings.length > 0,
    topFindingsView: report.top_findings.map(buildFindingView),
    hasAgents: !!report.metadata.agents_invoked?.length,
    agentsText: report.metadata.agents_invoked?.join(", ") ?? "",
    domainReportsView: report.domain_reports.map((dr) => ({
      domain: dr.domain,
      score: dr.score,
      domainName: capitalize(dr.domain),
      scoreColor: scoreToColor(dr.score),
      hasFindings: dr.findings.length > 0,
      findingCount: dr.findings.length,
      findingPlural: dr.findings.length !== 1 ? "s" : "",
      findingsView: dr.findings.map(buildFindingView),
    })),
  };
}

function buildFindingView(finding: Finding) {
  const loc = finding.evidence?.[0];
  return {
    id: finding.id,
    severity: finding.severity,
    title: finding.title,
    description: finding.description,
    recommendation: finding.recommendation,
    effort: finding.effort,
    confidence: finding.confidence,
    color: SEVERITY_COLORS[finding.severity] ?? "#6b7280",
    confidencePercent: (finding.confidence * 100).toFixed(0),
    hasEffort: !!finding.effort,
    hasLocation: !!loc,
    location: loc ? `${loc.file}${loc.line ? `:${loc.line}` : ""}` : "",
    hasDescription: !!finding.description,
    hasRecommendation: !!finding.recommendation,
  };
}

function scoreToColor(score: number): string {
  if (score >= 90) return "#22c55e";
  if (score >= 75) return "#84cc16";
  if (score >= 60) return "#eab308";
  if (score >= 40) return "#f97316";
  return "#ef4444";
}
