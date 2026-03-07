# ADR-005: Obsidian dark-theme for HTML reports

## Status

Accepted

## Context

Inspectra's `inspectra_render_html` tool generates standalone HTML audit reports. The report must be readable in both browser and PDF form, convey severity visually through colour, and look polished enough to share with stakeholders. A light theme on a white background causes eye strain during deep review sessions; a neutral palette makes severity colour-coding less distinctive.

## Decision

HTML reports use an Obsidian-inspired dark theme as the default:

- Background: `#1e1e2e` (deep navy) with surface cards at `#2a2a3d`.
- Typography: Inter (sans-serif) for body text, JetBrains Mono for code and IDs.
- Severity colours map to a traffic-light-derived palette: critical (`#ff4757`), high (`#ff6b35`), medium (`#ffa502`), low (`#2ed573`), info (`#70a1ff`).
- The overall score is rendered as an SVG progress ring with the grade letter centred inside.
- Domain cards use a CSS grid that reflows to a single column on narrow viewports.
- All styles are inlined in the HTML `<head>` so the file is fully self-contained (no external CDN dependencies).

Alternative light theme support is deferred to a future `--theme` flag.

## Consequences

- Reports are readable in dark-mode terminals and PDF viewers with dark backgrounds.
- Inlining styles (~12 KB) increases file size but eliminates network dependencies—critical for air-gapped environments.
- The theme is defined in `mcp/src/renderer/html-styles.ts` as a template literal; UI changes require editing TypeScript, not a separate CSS file.
- Colour contrast ratios for all text/background combinations meet WCAG AA (4.5:1 minimum) for accessibility.
