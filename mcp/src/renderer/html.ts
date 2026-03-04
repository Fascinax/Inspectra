import type { ConsolidatedReport, Finding } from "../types.js";
import { capitalize } from "../utils/strings.js";
import { renderStyles } from "./html-styles.js";

// ─── HTML Report Renderer ────────────────────────────────────────────────────
// Produces a self-contained HTML file with embedded CSS and inline SVG charts.
// Uses a dark "Obsidian" theme — no external dependencies.

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

export function renderHtml(report: ConsolidatedReport): string {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Inspectra Audit Report — ${escapeHtml(report.metadata.target)}</title>
  ${renderStyles()}
</head>
<body>
  <div class="container">
    ${renderHeader(report)}
    ${renderScoreCard(report)}
    ${renderDomainGrid(report)}
    ${renderSeverityChart(report)}
    ${renderTopFindings(report.top_findings)}
    ${renderDomainSections(report)}
    ${renderFooter(report)}
  </div>
</body>
</html>`;
}

// ─── Components ──────────────────────────────────────────────────────────────

function renderHeader(report: ConsolidatedReport): string {
  return `<header class="header">
  <h1>Inspectra Audit Report</h1>
  <p class="subtitle">${escapeHtml(report.metadata.target)} &middot; Profile: ${escapeHtml(report.metadata.profile)}</p>
</header>`;
}

function renderScoreCard(report: ConsolidatedReport): string {
  const { overall_score, grade, statistics } = report;
  const gradeColor = GRADE_COLORS[grade] ?? "#6b7280";
  const circumference = 2 * Math.PI * 58;
  const offset = circumference - (overall_score / 100) * circumference;
  const total = statistics?.total_findings ?? 0;

  return `<div class="score-card">
  <div class="score-ring">
    <svg width="140" height="140">
      <circle cx="70" cy="70" r="58" fill="none" stroke="var(--bg-surface)" stroke-width="8"/>
      <circle cx="70" cy="70" r="58" fill="none" stroke="${gradeColor}" stroke-width="8"
        stroke-dasharray="${circumference}" stroke-dashoffset="${offset}" stroke-linecap="round"/>
    </svg>
    <div class="score-text">
      <span class="score-value" style="color:${gradeColor}">${overall_score}</span>
      <span class="score-label">out of 100</span>
    </div>
  </div>
  <div class="score-meta">
    <div class="stat">
      <span class="stat-label">Grade</span>
      <span class="grade-badge" style="background:${gradeColor};color:var(--bg-primary)">${grade}</span>
    </div>
    <div class="stat">
      <span class="stat-label">Findings</span>
      <span class="stat-value">${total}</span>
    </div>
    <div class="stat">
      <span class="stat-label">Domains</span>
      <span class="stat-value">${report.domain_reports.length}</span>
    </div>
    ${report.metadata.duration_ms ? `<div class="stat">
      <span class="stat-label">Duration</span>
      <span class="stat-value">${(report.metadata.duration_ms / 1000).toFixed(1)}s</span>
    </div>` : ""}
  </div>
</div>`;
}

function renderDomainGrid(report: ConsolidatedReport): string {
  const cards = report.domain_reports.map((dr) => {
    const color = scoreToColor(dr.score);
    return `<div class="domain-card">
    <div class="domain-name">${escapeHtml(dr.domain)}</div>
    <div class="domain-score" style="color:${color}">${dr.score}<span style="font-size:0.9rem;color:var(--text-muted)">/100</span></div>
    <div class="progress-bar">
      <div class="progress-fill" style="width:${dr.score}%;background:${color}"></div>
    </div>
    <div class="finding-count">${dr.findings.length} finding${dr.findings.length !== 1 ? "s" : ""}</div>
  </div>`;
  });

  return `<div class="domain-grid">${cards.join("\n")}</div>`;
}

function renderSeverityChart(report: ConsolidatedReport): string {
  const sev = report.statistics?.by_severity;
  if (!sev) return "";

  const max = Math.max(sev.critical, sev.high, sev.medium, sev.low, sev.info, 1);
  const severities = ["critical", "high", "medium", "low", "info"] as const;

  const rows = severities.map((s) => {
    const count = sev[s];
    const pct = (count / max) * 100;
    const color = SEVERITY_COLORS[s] ?? "#6b7280";
    const label = SEVERITY_LABELS[s] ?? s;
    return `<div class="sev-row">
      <span class="sev-label">${label}</span>
      <div class="sev-bar-track">
        <div class="sev-bar-fill" style="width:${Math.max(pct, count > 0 ? 8 : 0)}%;background:${color}"></div>
      </div>
      <span class="sev-count" style="color:${color}">${count}</span>
    </div>`;
  });

  return `<div class="severity-chart">
  <h2>Findings by Severity</h2>
  <div class="severity-bars">${rows.join("\n")}</div>
</div>`;
}

function renderTopFindings(findings: ReadonlyArray<Finding>): string {
  if (findings.length === 0) return "";

  const items = findings.map((f) => renderFindingCard(f)).join("\n");
  return `<div class="section">
  <h2>Top Priority Findings</h2>
  ${items}
</div>`;
}

function renderDomainSections(report: ConsolidatedReport): string {
  return report.domain_reports
    .map((dr) => {
      if (dr.findings.length === 0) {
        return `<div class="domain-section">
  <h3>${capitalize(dr.domain)} (${dr.score}/100)</h3>
  <p style="color:var(--text-muted);font-style:italic">No findings — clean!</p>
</div>`;
      }

      const items = dr.findings.map((f) => renderFindingCard(f)).join("\n");
      return `<div class="domain-section">
  <h3>${capitalize(dr.domain)} (${dr.score}/100) — ${dr.findings.length} finding${dr.findings.length !== 1 ? "s" : ""}</h3>
  ${items}
</div>`;
    })
    .join("\n");
}

function renderFindingCard(finding: Finding): string {
  const color = SEVERITY_COLORS[finding.severity] ?? "#6b7280";
  const loc = finding.evidence?.[0];
  const location = loc ? `${escapeHtml(loc.file)}${loc.line ? `:${loc.line}` : ""}` : "";

  return `<div class="finding" style="border-left-color:${color}">
  <div class="finding-header">
    <span class="sev-dot" style="background:${color}"></span>
    <span class="finding-id">${escapeHtml(finding.id)}</span>
    <span class="finding-title">${escapeHtml(finding.title)}</span>
    <span class="tag" style="background:${color}22;color:${color}">${finding.severity}</span>
  </div>
  <div class="finding-meta">
    <span>Confidence: ${(finding.confidence * 100).toFixed(0)}%</span>
    ${finding.effort ? `<span>Effort: ${finding.effort}</span>` : ""}
    ${location ? `<span>📍 <code>${location}</code></span>` : ""}
  </div>
  ${finding.description ? `<div class="finding-desc">${escapeHtml(finding.description)}</div>` : ""}
  ${finding.recommendation ? `<div class="finding-fix">💡 ${escapeHtml(finding.recommendation)}</div>` : ""}
</div>`;
}

function renderFooter(report: ConsolidatedReport): string {
  const agents = report.metadata.agents_invoked?.join(", ") ?? "";
  return `<footer class="footer">
  <p>Generated by Inspectra on ${escapeHtml(report.metadata.timestamp)}</p>
  ${agents ? `<p>Agents: ${escapeHtml(agents)}</p>` : ""}
</footer>`;
}

// ─── Utilities ───────────────────────────────────────────────────────────────

function scoreToColor(score: number): string {
  if (score >= 90) return "#22c55e";
  if (score >= 75) return "#84cc16";
  if (score >= 60) return "#eab308";
  if (score >= 40) return "#f97316";
  return "#ef4444";
}

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}
