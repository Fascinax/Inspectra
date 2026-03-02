# Roadmap

## Current State (v0.2.0)

Inspectra is a functional multi-agent code audit system with:
- 5 Copilot Custom Agents (orchestrator + 4 domain agents)
- 19 MCP tools across 4 domains (12 from v0.1.0 + 7 new in v0.2.0)
- CLI orchestrator for local audits without Copilot
- JSON Schema contracts for all outputs
- Scoring engine with weighted domains and grade system
- Markdown and JSON report renderers
- SARIF output for CI integration
- 4 stack-specific profiles
- CI workflows for validation, PR audits, and report generation
- 139 unit tests

## v0.2.0 — Tool Depth ✅ COMPLETE

**Goal:** Make existing tools smarter and more accurate.

- [x] **Security:** Integrate Semgrep for deeper static analysis (beyond regex)
- [x] **Security:** Support Maven dependency analysis (`mvn dependency:tree`)
- [x] **Tests:** Parse Playwright HTML reports
- [x] **Tests:** Detect flaky tests (retry patterns, timeline analysis)
- [x] **Architecture:** Detect circular dependencies between modules
- [x] **Conventions:** Integrate ESLint/Checkstyle output parsing
- [x] **Conventions:** Detect copy-paste / DRY violations

## v0.3.0 — New Domains

**Goal:** Expand audit coverage to 6+ domains.

- [ ] **Performance agent:** Bundle size analysis, build timing, runtime metrics
- [ ] **Documentation agent:** README completeness, ADR presence, doc-code drift
- [ ] **Tech debt agent:** Complexity metrics, age of TODOs, dependency staleness

## v0.4.0 — PR Integration

**Goal:** Full PR workflow with automated comments.

- [ ] GitHub Action that runs the CLI on PR diffs
- [ ] PR comment with delta scoring (score change vs. main branch)
- [ ] Inline review comments on specific findings
- [ ] Status check: block merge if critical findings exist

## v0.5.0 — Report Engine

**Goal:** Rich, customizable report output.

- [ ] Handlebars templates for report sections
- [ ] Trend tracking (score over time)
- [ ] HTML report renderer with charts
- [ ] PDF export option
- [ ] Comparison mode: audit A vs. audit B

## v1.0.0 — Stable Release

**Goal:** Production-ready for teams.

- [ ] Published npm package (`npx inspectra audit`)
- [ ] VS Code extension for one-click audits
- [ ] Configuration UI for profiles and thresholds
- [ ] Plugin system for custom tools
- [ ] Multi-language support (Python, Go, Rust)
- [ ] Documentation site

## Future Ideas

- SonarQube adapter (import/export findings)
- Jira/GitHub Issues integration (auto-create issues from findings)
- Slack/Teams notifications on score drops
- AI-powered fix suggestions beyond recommendations
- Cross-repository benchmarking
