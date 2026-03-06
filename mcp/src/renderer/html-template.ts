/**
 * Handlebars template for the Inspectra HTML audit report.
 *
 * Uses Handlebars auto-escaping — `{{expression}}` is safe by default.
 * Use `{{{raw}}}` only for pre-built HTML (styles block).
 */

export const FINDING_PARTIAL = `<div class="finding" style="border-left-color:{{color}}">
  <div class="finding-header">
    <span class="sev-dot" style="background:{{color}}"></span>
    <span class="finding-id">{{id}}</span>
    <span class="finding-title">{{title}}</span>
    <span class="tag" style="background:{{color}}22;color:{{color}}">{{severity}}</span>
  </div>
  <div class="finding-meta">
    <span>Confidence: {{confidencePercent}}%</span>
    {{#if hasEffort}}<span>Effort: {{effort}}</span>{{/if}}
    {{#if hasLocation}}<span>\u{1F4CD} <code>{{location}}</code></span>{{/if}}
  </div>
  {{#if hasDescription}}<div class="finding-desc">{{description}}</div>{{/if}}
  {{#if hasRecommendation}}<div class="finding-fix">\u{1F4A1} {{recommendation}}</div>{{/if}}
</div>`;

export const REPORT_TEMPLATE = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Inspectra Audit Report &mdash; {{metadata.target}}</title>
  {{{stylesHtml}}}
</head>
<body>
  <div class="container">

    {{!-- Header --}}
    <header class="header">
      <h1>Inspectra Audit Report</h1>
      <p class="subtitle">{{metadata.target}} &middot; Profile: {{metadata.profile}}</p>
    </header>

    {{!-- Score Card --}}
    <div class="score-card">
      <div class="score-ring">
        <svg width="140" height="140">
          <circle cx="70" cy="70" r="58" fill="none" stroke="var(--bg-surface)" stroke-width="8"/>
          <circle cx="70" cy="70" r="58" fill="none" stroke="{{gradeColor}}" stroke-width="8"
            stroke-dasharray="{{circumference}}" stroke-dashoffset="{{offset}}" stroke-linecap="round"/>
        </svg>
        <div class="score-text">
          <span class="score-value" style="color:{{gradeColor}}">{{overall_score}}</span>
          <span class="score-label">out of 100</span>
        </div>
      </div>
      <div class="score-meta">
        <div class="stat">
          <span class="stat-label">Grade</span>
          <span class="grade-badge" style="background:{{gradeColor}};color:var(--bg-primary)">{{grade}}</span>
        </div>
        <div class="stat">
          <span class="stat-label">Findings</span>
          <span class="stat-value">{{totalFindings}}</span>
        </div>
        <div class="stat">
          <span class="stat-label">Domains</span>
          <span class="stat-value">{{domainCount}}</span>
        </div>
        {{#if hasDuration}}
        <div class="stat">
          <span class="stat-label">Duration</span>
          <span class="stat-value">{{durationSeconds}}s</span>
        </div>
        {{/if}}
      </div>
    </div>

    {{!-- Domain Nav --}}
    <nav class="domain-nav" aria-label="Jump to domain">
      {{#each domainReportsView}}
      <a href="#domain-{{domainId}}" class="domain-nav-pill" style="border-color:{{scoreColor}};color:{{scoreColor}}">{{domainName}}</a>
      {{/each}}
    </nav>

    {{!-- Domain Grid --}}
    <div class="domain-grid">
      {{#each domainReportsView}}
      <a class="domain-card" href="#domain-{{domainId}}">
        <div class="domain-name">{{domain}}</div>
        <div class="domain-score" style="color:{{scoreColor}}">{{score}}<span style="font-size:0.9rem;color:var(--text-muted)">/100</span></div>
        <div class="progress-bar">
          <div class="progress-fill" style="width:{{score}}%;background:{{scoreColor}}"></div>
        </div>
        <div class="domain-card-footer">
          <span class="finding-count">{{findingCount}} finding{{findingPlural}}</span>
          {{#if hasSevBadges}}<span class="domain-sev-badges">{{#each sevBadges}}<span class="sev-mini" style="background:{{color}}22;color:{{color}}">{{label}}&thinsp;{{count}}</span>{{/each}}</span>{{/if}}
        </div>
      </a>
      {{/each}}
    </div>

    {{!-- Severity Chart --}}
    {{#if hasSeverityData}}
    <div class="severity-chart">
      <h2>Findings by Severity</h2>
      <div class="severity-bars">
        {{#each severities}}
        <div class="sev-row">
          <span class="sev-label">{{label}}</span>
          <div class="sev-bar-track">
            <div class="sev-bar-fill" style="width:{{pct}}%;background:{{color}}"></div>
          </div>
          <span class="sev-count" style="color:{{color}}">{{count}}</span>
        </div>
        {{/each}}
      </div>
    </div>
    {{/if}}

    {{!-- Top Findings --}}
    {{#if hasTopFindings}}
    <div class="section">
      <h2>Top Priority Findings</h2>
      {{#each topFindingsView}}
      {{> findingCard}}
      {{/each}}
    </div>
    {{/if}}

    {{!-- Domain Sections --}}
    {{#each domainReportsView}}
    <details class="domain-section" id="domain-{{domainId}}" open>
      <summary class="domain-summary">
        <span class="domain-summary-name">{{domainName}}</span>
        <span class="domain-summary-score" style="color:{{scoreColor}}">{{score}}/100</span>
        {{#if hasFindings}}<span class="domain-summary-count">{{findingCount}} finding{{findingPlural}}</span>{{/if}}
        <span class="domain-chevron">&#9660;</span>
      </summary>
      {{#if hasFindings}}
      <div class="findings-list">
        {{#each findingsView}}
        {{> findingCard}}
        {{/each}}
      </div>
      {{else}}
      <p class="no-findings">No findings &mdash; clean!</p>
      {{/if}}
    </details>
    {{/each}}

    {{!-- Footer --}}
    <footer class="footer">
      <p>Generated by Inspectra on {{metadata.timestamp}}</p>
      {{#if hasAgents}}
      <p>Agents: {{agentsText}}</p>
      {{/if}}
    </footer>

  </div>
  <a href="#" class="back-to-top" title="Back to top" aria-label="Back to top">&#8593;</a>
</body>
</html>`;
