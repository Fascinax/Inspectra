# Roadmap

## Current State (v0.3.0)

Inspectra is a functional multi-agent code audit system with:
- 8 Copilot Custom Agents (orchestrator + 7 domain agents)
- 28 MCP tools across 7 domains
- CLI orchestrator for local audits without Copilot
- JSON Schema contracts for all outputs
- Scoring engine with weighted domains and grade system
- Markdown and JSON report renderers
- SARIF output for CI integration
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

## v0.4.0 - PR Integration

Goal: Full PR workflow with automated comments.

- [ ] GitHub Action that runs the CLI on PR diffs
- [ ] PR comment with delta scoring (score change vs. main branch)
- [ ] Inline review comments on specific findings
- [ ] Status check: block merge if critical findings exist

## v0.5.0 - Report Engine

Goal: Rich, customizable report output.

- [ ] Handlebars templates for report sections
- [ ] Trend tracking (score over time)
- [ ] HTML report renderer with charts
- [ ] PDF export option
- [ ] Comparison mode: audit A vs. audit B

## v1.0.0 - Stable Release

Goal: Production-ready for teams.

- [ ] Published npm package (`npx inspectra audit`)
- [ ] VS Code extension for one-click audits
- [ ] Configuration UI for profiles and thresholds
- [ ] Plugin system for custom tools
- [ ] Multi-language support (Python, Go, Rust)
- [ ] Documentation site
