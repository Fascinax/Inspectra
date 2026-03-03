import type { ConsolidatedReport, Finding } from "../types.js";
import { capitalize } from "../utils/strings.js";

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

// ─── Styles (Obsidian theme) ─────────────────────────────────────────────────

function renderStyles(): string {
  return `<style>
  :root {
    --bg-primary: #0f0f13;
    --bg-card: #1a1a24;
    --bg-card-hover: #22222e;
    --bg-surface: #252533;
    --text-primary: #e8e8ed;
    --text-secondary: #9898a6;
    --text-muted: #6b6b7b;
    --border: #2a2a3a;
    --accent: #818cf8;
    --accent-glow: rgba(129, 140, 248, 0.15);
    --green: #22c55e;
    --font-mono: 'SF Mono', 'Cascadia Code', 'JetBrains Mono', monospace;
    --font-sans: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
    --radius: 12px;
    --radius-sm: 8px;
  }

  * { margin: 0; padding: 0; box-sizing: border-box; }

  body {
    font-family: var(--font-sans);
    background: var(--bg-primary);
    color: var(--text-primary);
    line-height: 1.6;
    min-height: 100vh;
  }

  .container {
    max-width: 1100px;
    margin: 0 auto;
    padding: 40px 24px;
  }

  /* ── Header ── */
  .header {
    text-align: center;
    margin-bottom: 48px;
  }
  .header h1 {
    font-size: 2rem;
    font-weight: 700;
    letter-spacing: -0.02em;
    margin-bottom: 8px;
    background: linear-gradient(135deg, var(--accent), #a78bfa);
    -webkit-background-clip: text;
    -webkit-text-fill-color: transparent;
  }
  .header .subtitle {
    color: var(--text-secondary);
    font-size: 0.95rem;
  }

  /* ── Score Card ── */
  .score-card {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 40px;
    padding: 36px;
    background: var(--bg-card);
    border: 1px solid var(--border);
    border-radius: var(--radius);
    margin-bottom: 32px;
  }
  .score-ring {
    position: relative;
    width: 140px;
    height: 140px;
  }
  .score-ring svg {
    transform: rotate(-90deg);
  }
  .score-ring .score-text {
    position: absolute;
    inset: 0;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
  }
  .score-ring .score-value {
    font-size: 2.5rem;
    font-weight: 700;
    font-family: var(--font-mono);
    line-height: 1;
  }
  .score-ring .score-label {
    font-size: 0.8rem;
    color: var(--text-muted);
    margin-top: 4px;
  }
  .score-meta {
    display: flex;
    flex-direction: column;
    gap: 12px;
  }
  .score-meta .stat {
    display: flex;
    align-items: center;
    gap: 12px;
  }
  .stat-label {
    color: var(--text-secondary);
    font-size: 0.85rem;
    min-width: 100px;
  }
  .stat-value {
    font-weight: 600;
    font-family: var(--font-mono);
  }
  .grade-badge {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    width: 36px;
    height: 36px;
    border-radius: var(--radius-sm);
    font-weight: 700;
    font-size: 1.1rem;
    font-family: var(--font-mono);
  }

  /* ── Domain Grid ── */
  .domain-grid {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(240px, 1fr));
    gap: 16px;
    margin-bottom: 32px;
  }
  .domain-card {
    background: var(--bg-card);
    border: 1px solid var(--border);
    border-radius: var(--radius);
    padding: 20px;
    transition: background 0.2s;
  }
  .domain-card:hover { background: var(--bg-card-hover); }
  .domain-card .domain-name {
    font-size: 0.82rem;
    text-transform: uppercase;
    letter-spacing: 0.08em;
    color: var(--text-muted);
    margin-bottom: 8px;
  }
  .domain-card .domain-score {
    font-size: 1.8rem;
    font-weight: 700;
    font-family: var(--font-mono);
    margin-bottom: 8px;
  }
  .progress-bar {
    height: 6px;
    background: var(--bg-surface);
    border-radius: 3px;
    overflow: hidden;
  }
  .progress-fill {
    height: 100%;
    border-radius: 3px;
    transition: width 0.6s ease;
  }
  .domain-card .finding-count {
    margin-top: 10px;
    font-size: 0.82rem;
    color: var(--text-secondary);
  }

  /* ── Severity Chart ── */
  .severity-chart {
    background: var(--bg-card);
    border: 1px solid var(--border);
    border-radius: var(--radius);
    padding: 24px;
    margin-bottom: 32px;
  }
  .severity-chart h2 {
    font-size: 1rem;
    margin-bottom: 20px;
    color: var(--text-secondary);
  }
  .severity-bars {
    display: flex;
    flex-direction: column;
    gap: 12px;
  }
  .sev-row {
    display: flex;
    align-items: center;
    gap: 12px;
  }
  .sev-label {
    width: 80px;
    font-size: 0.82rem;
    color: var(--text-secondary);
    text-align: right;
  }
  .sev-bar-track {
    flex: 1;
    height: 24px;
    background: var(--bg-surface);
    border-radius: 4px;
    overflow: hidden;
  }
  .sev-bar-fill {
    height: 100%;
    border-radius: 4px;
    display: flex;
    align-items: center;
    padding-left: 8px;
    font-size: 0.75rem;
    font-weight: 600;
    color: var(--bg-primary);
    min-width: fit-content;
    transition: width 0.6s ease;
  }
  .sev-count {
    width: 36px;
    font-family: var(--font-mono);
    font-size: 0.85rem;
    font-weight: 600;
    text-align: right;
  }

  /* ── Findings ── */
  .section { margin-bottom: 32px; }
  .section h2 {
    font-size: 1.15rem;
    margin-bottom: 16px;
    padding-bottom: 8px;
    border-bottom: 1px solid var(--border);
  }
  .finding {
    background: var(--bg-card);
    border: 1px solid var(--border);
    border-left: 3px solid var(--accent);
    border-radius: var(--radius-sm);
    padding: 16px 20px;
    margin-bottom: 12px;
  }
  .finding-header {
    display: flex;
    align-items: center;
    gap: 10px;
    margin-bottom: 6px;
    flex-wrap: wrap;
  }
  .sev-dot {
    width: 10px;
    height: 10px;
    border-radius: 50%;
    flex-shrink: 0;
  }
  .finding-id {
    font-family: var(--font-mono);
    font-size: 0.85rem;
    color: var(--accent);
    font-weight: 600;
  }
  .finding-title {
    font-weight: 600;
    font-size: 0.95rem;
  }
  .finding-meta {
    display: flex;
    gap: 16px;
    margin-top: 6px;
    font-size: 0.82rem;
    color: var(--text-secondary);
    flex-wrap: wrap;
  }
  .finding-desc {
    margin-top: 8px;
    font-size: 0.88rem;
    color: var(--text-secondary);
    line-height: 1.5;
  }
  .finding-fix {
    margin-top: 8px;
    padding: 10px 14px;
    background: var(--accent-glow);
    border-radius: var(--radius-sm);
    font-size: 0.85rem;
    color: var(--accent);
  }
  .tag {
    display: inline-block;
    padding: 2px 8px;
    border-radius: 4px;
    font-size: 0.75rem;
    font-weight: 600;
    text-transform: uppercase;
    letter-spacing: 0.04em;
  }

  /* ── Domain Section ── */
  .domain-section {
    margin-bottom: 40px;
  }
  .domain-section h3 {
    font-size: 1.05rem;
    margin-bottom: 14px;
    color: var(--text-primary);
  }

  /* ── Footer ── */
  .footer {
    text-align: center;
    padding-top: 32px;
    border-top: 1px solid var(--border);
    color: var(--text-muted);
    font-size: 0.82rem;
  }

  /* ── Responsive ── */
  @media (max-width: 680px) {
    .score-card { flex-direction: column; gap: 20px; }
    .domain-grid { grid-template-columns: 1fr; }
  }
</style>`;
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
