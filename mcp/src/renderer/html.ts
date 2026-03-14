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

function lucide(paths: string): string {
  return '<svg class="lucide" xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">' + paths + '</svg>';
}

const DOMAIN_ICONS: Record<string, string> = {
  security: lucide('<path d="m12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10"/>'),
  tests: lucide('<path d="M10 2v7.527a2 2 0 0 1-.211.896L4.72 20.55a1 1 0 0 0 .9 1.45h12.76a1 1 0 0 0 .9-1.45l-5.069-10.127A2 2 0 0 1 14 9.527V2"/><path d="M8.5 2h7"/><path d="M7 16h10"/>'),
  architecture: lucide('<path d="M21 8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16Z"/><path d="m3.3 7 8.7 5 8.7-5"/><path d="M12 22V12"/>'),
  conventions: lucide('<path d="m3 17 2 2 4-4"/><path d="m3 7 2 2 4-4"/><path d="M13 6h8"/><path d="M13 12h8"/><path d="M13 18h8"/>'),
  performance: lucide('<path d="M13 2 3 14h9l-1 8 10-12h-9z"/>'),
  documentation: lucide('<path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z"/><path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z"/>'),
  "tech-debt": lucide('<path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z"/>'),
  accessibility: lucide('<circle cx="16" cy="4" r="1"/><path d="m18 19 1-7-6 1"/><path d="m5 8 3-3 5.5 3-2.36 3.5"/><path d="m4.24 14.5 2.5 4.5"/><path d="m14.4 18 3.1-5.5"/>'),
  "api-design": lucide('<path d="M9 17H7A5 5 0 0 1 7 7h2"/><path d="M15 7h2a5 5 0 0 1 0 10h-2"/><line x1="8" x2="16" y1="12" y2="12"/>'),
  observability: lucide('<path d="M2 12s3-7 10-7 10 7 10 7-3 7-10 7-10-7-10-7Z"/><circle cx="12" cy="12" r="3"/>'),
  i18n: lucide('<circle cx="12" cy="12" r="10"/><path d="M12 2a14.5 14.5 0 0 0 0 20 14.5 14.5 0 0 0 0-20"/><path d="M2 12h20"/>'),
  "ux-consistency": lucide('<rect width="7" height="7" x="3" y="3" rx="1"/><rect width="7" height="7" x="14" y="3" rx="1"/><rect width="7" height="7" x="14" y="14" rx="1"/><rect width="7" height="7" x="3" y="14" rx="1"/>'),
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
    hasDomains: !!report.metadata.domains_audited?.length,
    domainsText: report.metadata.domains_audited?.join(", ") ?? "",
    domainReportsView: report.domain_reports.map((dr) => {
      const findingsView = dr.findings.map(buildFindingView);
      const critCount = dr.findings.filter((f) => f.severity === "critical").length;
      const highCount = dr.findings.filter((f) => f.severity === "high").length;
      const medCount = dr.findings.filter((f) => f.severity === "medium").length;
      const sevBadges = [
        ...(critCount > 0 ? [{ label: "C", count: critCount, color: "#ef4444" }] : []),
        ...(highCount > 0 ? [{ label: "H", count: highCount, color: "#f97316" }] : []),
        ...(medCount > 0 ? [{ label: "M", count: medCount, color: "#eab308" }] : []),
      ];
      return {
        domain: dr.domain,
        domainId: dr.domain.toLowerCase().replace(/[^a-z0-9]/g, "-"),
        score: dr.score,
        domainName: capitalize(dr.domain),
        domainIcon: new Handlebars.SafeString(DOMAIN_ICONS[dr.domain] ?? "\u{1F50D}"),
        scoreColor: scoreToColor(dr.score),
        hasFindings: dr.findings.length > 0,
        findingCount: dr.findings.length,
        findingPlural: dr.findings.length !== 1 ? "s" : "",
        findingsView,
        hasSevBadges: sevBadges.length > 0,
        sevBadges,
      };
    }),
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
