# Roadmap

## Current State (v0.7.0)

Inspectra is a functional multi-agent code audit system with:

- 13 Copilot Custom Agents (orchestrator + 12 domain agents) with enriched Phase 2 prompts
- 36 MCP tools across 12 domains (security, tests, architecture, conventions, performance, documentation, tech-debt, accessibility, api-design, observability, i18n, ux-consistency)
- JSON Schema contracts for all outputs (11-domain finding validation)
- Scoring engine with weighted domains (12 domains) and grade system
- Markdown, JSON, HTML, SARIF, and PDF report renderers
- Trend tracking and audit comparison via MCP tools
- 5 stack-specific profiles with per-profile complexity thresholds
- Context-aware secret detection with placeholder + comment filtering
- Per-project configuration via `.inspectrarc.yml` and finding suppression via `.inspectraignore`
- Claude Code support: `CLAUDE.md`, `.mcp.json`, `inspectra setup --claude` CLI
- `inspectra doctor` diagnostic command
- 503+ passing tests across 64+ test files

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

## v0.6.0 — Agent & Tool Quality — COMPLETE

Goal: Make existing agents smarter and tools more precise.

### Improve Current Agents

- [x] Tune Phase 2 (LLM exploration) prompts based on real audit feedback
- [x] Better severity calibration: reduce false positives, sharpen critical/high distinction
- [x] Add domain-specific examples in agent prompts to guide LLM reasoning
- [x] Improve orchestrator deduplication across tool + LLM findings

### Better Tools

- [x] Security: reduce false-positive rate on secret detection (context-aware patterns)
- [ ] Architecture: support monorepo multi-project layering
- [x] Conventions: framework-aware naming rules (e.g., Angular `*Component`, `*Service`)
- [x] Tests: detect test quality issues (shallow assertions, missing error paths)
- [x] Performance: detect common anti-patterns per framework (N+1 in ORMs, missing `trackBy` in Angular — via Phase 2 search strategy in agent prompt)

### Developer Experience

- [x] `inspectra doctor` command: diagnose setup issues (Node version, MCP connectivity, missing agents) — moved to v0.7.0
- [x] Clearer error messages when a tool fails (structured error with suggested fix)
- [x] Config file support (`.inspectraignore`) to suppress findings per project
- [x] Config file support (`.inspectrarc.yml`) for full profile, threshold, and rule customization
- [ ] Improve profile auto-detection accuracy (detect monorepo structures) — deferred to v0.8.0

## v0.7.0 — Multi-Runtime & New Agents ✅ COMPLETE

Goal: Run Inspectra beyond Copilot, expand domain coverage.

### CLI Improvements

- [x] `inspectra doctor` command: checks Node.js version, MCP build, VS Code settings, agent files, policies, schemas
- [x] Config file support: `utils/project-config.ts` loads `.inspectrarc.yml` / `.inspectrarc.yaml` / `inspectra.config.yml`

### Claude Code & Codex Support

- [x] Adapter tool: `inspectra_generate_claude_md` — generates `CLAUDE.md` from `.agent.md` sources with full audit workflow, MCP tools table, scoring model, and finding contract
- [x] Adapter tool: `inspectra_generate_codex_agents_md` — generates Codex-compatible `AGENTS.md` from `.agent.md` sources
- [x] Shared MCP tools work as-is (MCP protocol is runtime-agnostic)
- [x] `CLAUDE.md` at repo root for Inspectra development context
- [x] `.mcp.json` at repo root for Claude Code MCP auto-connection
- [x] CLI: `inspectra setup --claude` — generates `CLAUDE.md` + `.mcp.json` in the current directory
- [x] CLI: `inspectra setup --codex` — generates `AGENTS.md` + `.codex/config.toml` in the current directory
- [x] CLI: `inspectra init <project> --claude` — project setup for Claude Code (symlink or copy mode)
- [x] CLI: `inspectra init <project> --codex` — project setup for OpenAI Codex (symlink or copy mode)
- [x] Setup documentation: `docs/claude-code-setup.md` and `docs/codex-setup.md` with comparison table

### New Agents

- [x] Accessibility agent (`audit-accessibility`): detect a11y issues in templates — `inspectra_check_a11y_templates` (ACC- prefix)
- [x] API design agent (`audit-api-design`): REST consistency, naming, versioning — `inspectra_check_rest_conventions` (API- prefix)
- [x] Observability agent (`audit-observability`): detect missing logging, tracing, health checks — `inspectra_check_observability` (OBS- prefix)
- [x] i18n agent (`audit-i18n`): detect hardcoded strings, missing i18n library — `inspectra_check_i18n` (INT- prefix)

## v0.8.0 — Community Ready

Goal: Package and publish for external users.

- [ ] Publish to npm (`npx inspectra setup`)
- [x] Contributing guide (CONTRIBUTING.md)
- [ ] README badges (CI status, npm version, test count)
- [ ] Demo GIF/video in README showing a full audit run
- [x] Changelog (CHANGELOG.md, auto-generated from conventional commits)
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
