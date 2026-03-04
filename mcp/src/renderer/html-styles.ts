/**
 * Obsidian dark theme CSS for HTML audit reports.
 */
export function renderStyles(): string {
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
