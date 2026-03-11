# Roadmap

## Current State (v0.7.3)

Inspectra is a functional multi-agent code audit system with:

- 13 Copilot Custom Agents (orchestrator + 12 domain agents) with enriched Phase 2 prompts
- 42 MCP tools across 12 domains (security, tests, architecture, conventions, performance, documentation, tech-debt, accessibility, api-design, observability, i18n, ux-consistency)
- JSON Schema contracts for all outputs (12-domain finding validation)
- Scoring engine with weighted domains (12 domains) and grade system
- Markdown, JSON, HTML, SARIF, and PDF report renderers
- Trend tracking and audit comparison via MCP tools
- 5 stack-specific profiles with per-profile complexity thresholds
- Context-aware secret detection with placeholder + comment filtering
- Per-project configuration via `.inspectrarc.yml` and finding suppression via `.inspectraignore`
- Claude Code support: `CLAUDE.md`, `.mcp.json`, `inspectra setup --claude` CLI
- Codex support: `AGENTS.md`, `.codex/config.toml`, `inspectra setup --codex` CLI
- `inspectra doctor` diagnostic command
- Internal patterns: FindingBuilder, handler factory, shared constants
- 750+ passing tests across 79 test files

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

- [x] Publish to npm (`npx inspectra setup`)
- [x] Contributing guide (CONTRIBUTING.md)
- [x] README badges (CI status, npm version, test count)
- [ ] Demo GIF/video in README showing a full audit run
- [x] Changelog (CHANGELOG.md, auto-generated from conventional commits)
- [x] GitHub Releases with pre-built artifacts

## v0.9.0 — Architecture Benchmark & Diagnostic Intelligence

Goal: **Prove which architecture tier actually delivers the best diagnostic quality before building more complexity.** Then invest in the winning tier.

See [ADR-008: Benchmark Before Architecture](adr/008-benchmark-before-architecture.md) for the full decision framework.  
See [ADR-007: Diagnostic Intelligence Layer](adr/007-diagnostic-intelligence-layer.md) for the diagnostic layer design (gated by benchmark results).

### Phase 0 — Architecture Benchmark (do this FIRST)

Three tiers compete on the same repos, measured by the same expert panel:

| Tier | Architecture | Cost | Description |
|---|---|---|---|
| **A** | 1 orchestrator, all tools, 1 LLM synthesis | Lowest | No sub-agents, no Phase 2. Single pass. |
| **B** | Tools + structured domain analysis + conditional explorer | Medium | 1 explorer agent fires only on hotspot signals. |
| **C** | Current: 12 agents × (Phase 1 tools + Phase 2 LLM) | Highest | Full multi-agent deep exploration. |

- [ ] Establish ground truth: expert-written issue lists for 3-5 target repos (`evaluations/ground-truth/`)
- [ ] Tier A prompt: `.github/prompts/audit-tier-a.prompt.md` — single-pass orchestrator with all tools
- [ ] Tier B prompt: `.github/prompts/audit-tier-b.prompt.md` — hybrid with conditional explorer
- [ ] Tier C: current system (no changes needed)
- [ ] Evaluation harness: `evaluations/benchmark-harness.ts` — runs all tiers, collects metrics
- [ ] Run benchmark: 3 tiers × 3-5 repos × 3 runs = 27-45 audit runs
- [ ] Expert review: blind scoring on precision, recall, root cause hit rate, actionability (1-5)
- [ ] Analysis and verdict: `evaluations/benchmark-results.md`
- [ ] Architectural decision: commit to winning tier for the diagnostic layer foundation

**Decision gates:**
- Tier A ≈ Tier C on quality → **simplify radically**, keep tools + single synthesis
- Tier B > A but ≈ C → **adopt hybrid**, 1 orchestrator + 1 conditional explorer
- Tier C >> B >> A → **current arch justified**, proceed with ADR-007 as designed
- All ≈ on quality, C costs 10x more → **cost efficiency wins**, simplify

### Phase 3 — Correlation Engine (gated by benchmark — applies to winning tier)

- [ ] Hotspot detection: group findings by file, module, dependency, or pattern convergence
  - File hotspot: 3+ findings from 2+ domains on the same file
  - Module hotspot: 5+ findings across files in a shared directory
  - Dependency hotspot: multiple findings tracing to the same external dependency
  - Pattern hotspot: same rule triggered 5+ times across different files
- [ ] Implement `mcp/src/merger/correlate.ts` with `Hotspot` and clustering logic
- [ ] New MCP tool: `inspectra_correlate_findings`

### Phase 3b — Root Cause Inference

- [ ] Root cause taxonomy: god-module, missing-abstraction, dependency-rot, test-gap, convention-drift, misaligned-architecture, security-shortcut, documentation-debt, isolated
- [ ] Rules-based pattern matching: `policies/root-cause-patterns.yml` maps hotspot signatures to root cause categories
- [ ] LLM-assisted inference for hotspots that don't match known patterns (confidence ≤ 0.6)
- [ ] Implement `mcp/src/merger/root-cause.ts` with `RootCauseCluster` structure
- [ ] New MCP tool: `inspectra_infer_root_causes`
- [ ] New schema: `schemas/root-cause-cluster.schema.json`

### Phase 4 — Prioritization Engine

- [ ] Impact scoring per cluster: `severity_ceiling × blast_radius × remediation_leverage / effort`
- [ ] Remediation plan: group clusters into Fix Now / Next Sprint / Backlog batches
- [ ] Score simulation: "fixing these 2 root causes brings you from 62/100 to 81/100"
- [ ] Implement `mcp/src/merger/prioritize.ts` with `RemediationPlan` structure
- [ ] New MCP tool: `inspectra_build_remediation_plan`
- [ ] New schema: `schemas/remediation-plan.schema.json`

### Phase 5 — Enhanced Report

- [ ] Diagnosis-first report layout: Executive Diagnosis → Remediation Plan → Root Cause Analysis → Domain Breakdown
- [ ] Executive Diagnosis: 3 sentences max, 1-3 root causes that matter, expected score after fix, first action
- [ ] Remediation batches with effort, impact, estimated score improvement, and fix dependencies
- [ ] Score context: what the number captures and what it doesn't
- [ ] Update HTML/PDF/Markdown renderers for diagnosis-first layout

### Orchestrator Evolution

- [ ] Architecture adapted to benchmark winner (may be 1 prompt, hybrid, or multi-agent)
- [ ] Orchestrator produces root cause clusters, not just flat top-10 findings
- [ ] Backward-compatible: `clusters` and `remediation_plan` are optional fields in consolidated report schema

---

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
- Scoring calibration: benchmark against expert audits to validate score fidelity
- Feedback loop: let users flag false root causes to improve pattern matching
