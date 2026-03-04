# Roadmap

## Current State (v0.5.0)

Inspectra is a functional multi-agent code audit system with:
- 8 Copilot Custom Agents (orchestrator + 7 domain agents)
- 28 MCP tools across 7 domains
- JSON Schema contracts for all outputs
- Scoring engine with weighted domains and grade system
- Markdown, JSON, HTML, and SARIF report renderers
- Trend tracking and audit comparison via MCP tools
- 4 stack-specific profiles

## v0.2.0 - Tool Depth COMPLETE

Goal: Make existing tools smarter and more accurate.

- [x] Security: integrate Semgrep for deeper static analysis
- [x] Security: support Maven dependency analysis (`mvn dependency:tree`)
- [x] Tests: parse Playwright HTML reports
- [x] Tests: detect flaky tests
- [x] Architecture: detect circular dependencies between modules
- [x] Conventions: integrate ESLint/Checkstyle output parsing
- [x] Conventions: detect copy-paste / DRY violations

## v0.3.0 - New Domains COMPLETE

Goal: Expand audit coverage to 6+ domains.

- [x] Performance agent: bundle size analysis, build timing, runtime metrics
- [x] Documentation agent: README completeness, ADR presence, doc-code drift
- [x] Tech debt agent: complexity metrics, age of TODOs, dependency staleness

## v0.4.0 - PR Integration COMPLETE

Goal: Full PR workflow with automated comments.

- [x] PR comment with delta scoring (score change vs. main branch)
- [x] Inline review comments on specific findings
- [x] Status check: block merge if critical findings exist

## v0.5.0 - Report Engine COMPLETE

Goal: Rich, customizable report output.

- [x] Trend tracking (score over time)
- [x] HTML report renderer with charts (Obsidian dark theme)
- [x] Comparison mode: audit A vs. audit B
- [x] Handlebars templates for report sections
- [ ] PDF export option

## v1.0.0 - Stable Release

Goal: Production-ready for teams.

- [ ] VS Code extension for one-click audits
- [ ] Configuration UI for profiles and thresholds
- [ ] Plugin system for custom tools
- [ ] Multi-language support (Python, Go, Rust)
- [ ] Documentation site
