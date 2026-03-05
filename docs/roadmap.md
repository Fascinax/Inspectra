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
- 455 passing tests across 58 test files

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
- [x] PDF export option

---

## v0.6.0 — Developer Experience & Polish

Goal: Make Inspectra easy to use, debug, and trust.

- [ ] `inspectra doctor` command: diagnose setup issues (Node version, MCP connectivity, missing agents)
- [ ] Clearer error messages when a tool fails (structured error with suggested fix)
- [ ] `--json` output flag on CLI commands for CI/script consumption
- [ ] Config file support (`.inspectrarc.yml`) to customize profiles, thresholds, ignored paths per project
- [ ] Improve profile auto-detection accuracy (detect monorepo structures)

## v0.7.0 — Community Ready

Goal: Package and publish for external users.

- [ ] Publish to npm (`npx inspectra setup`)
- [ ] Contributing guide (CONTRIBUTING.md)
- [ ] README badges (CI status, npm version, test count)
- [ ] Demo GIF/video in README showing a full audit run
- [ ] Changelog (CHANGELOG.md, auto-generated from conventional commits)
- [ ] GitHub Releases with pre-built artifacts

## v1.0.0 — Stable Release

Goal: Stability contract — no breaking changes to schemas, tools, or CLI.

- [ ] Semver commitment: schemas, tool names, and CLI flags are stable
- [ ] All existing features hardened with edge-case tests
- [ ] Lightweight plugin system (drop a `.ts` tool file into a `plugins/` folder)
- [ ] At least 2 real-world audit reports shared as case studies in `examples/`
- [ ] Comprehensive README with troubleshooting section

---

## Future Ideas (post-v1.0, unscheduled)

These are aspirational. They'll only be prioritized if there's real user demand.

- VS Code extension for one-click audits
- Configuration UI for profiles and thresholds
- Multi-language support (Python, Go, Rust analyzers)
- Documentation site (likely Docusaurus or VitePress)
- Dashboard web app for audit history visualization
- Slack/Teams webhook integration for audit notifications
