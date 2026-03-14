# Inspectra — Global Copilot Instructions

## Project Overview

Inspectra is a hybrid code audit system. The default workflow runs deterministic MCP tools across 12 domains, performs optional hotspot exploration, then synthesizes the results in a single prompt across security, tests, architecture, conventions, performance, documentation, tech-debt, accessibility, api-design, observability, i18n, and ux-consistency.

## Architecture

- **MCP Server** (`mcp/`): TypeScript server exposing audit tools via Model Context Protocol.
- **Schemas** (`schemas/`): JSON Schema contracts for findings and reports.
- **Policies** (`policies/`): Scoring rules, severity matrix, and stack-specific profiles.
- **Prompts** (`.github/prompts/`): Reusable entry points for common audit workflows.
- **Claude Code support**: `CLAUDE.md` + `.mcp.json` at repo root; `inspectra setup --claude` for target projects.
- **Codex support**: `AGENTS.md` + `.codex/config.toml`; `inspectra setup --codex` for target projects.

## Critical Rules

### Output Format

All audit workflows and domain reports MUST return structured JSON following the schemas in `schemas/`. Never return free-form text as the primary output. The merge/report stage is the only place that produces the final Markdown report.

### Finding Contract

Every finding MUST include:
- `id`: Pattern `DOMAIN_PREFIX-XXX` (e.g., `SEC-001`, `TST-042`)
- `severity`: One of `critical`, `high`, `medium`, `low`, `info`
- `domain`: The audit domain that produced it
- `rule`: Machine-readable rule identifier
- `confidence`: Float between 0.0 and 1.0
- `source`: One of `tool` (MCP tool detection) or `llm` (LLM code exploration)
- `evidence`: At least one file path

#### Source & Confidence Rules

- Tool-detected findings (`source: "tool"`): `confidence ≥ 0.8`, IDs 001–499
- LLM-detected findings (`source: "llm"`): `confidence ≤ 0.7`, IDs 501+

### Scoring

- Domain scores range from 0 to 100 (100 = no issues).
- Overall score is a weighted average of audited domain scores. Core weights: security 24%, tests 20%, architecture 16%, conventions 12%, performance 10%, documentation 8%, tech-debt 10%. Extended weights (v0.7+): accessibility 8%, api-design 7%, observability 6%, i18n 5%. Extended weights (v0.8+): ux-consistency 6%. Weights are re-normalized at runtime based on which domains were actually audited.
- Only domains actually audited contribute to the weighted average.
- Reference `policies/scoring-rules.yml` for authoritative values.
- Grades: A (90+), B (75+), C (60+), D (40+), F (<40).

### MCP Tools

Tools are registered in the `inspectra` MCP server. Prompt workflows should call them by prefixed name (e.g., `inspectra_scan_secrets`). Available tools:

| Tool | Domain | Purpose |
| ------ | -------- | --------- |
| `inspectra_scan_secrets` | Security | Detect hardcoded secrets |
| `inspectra_check_deps_vulns` | Security | npm audit for vulnerabilities |
| `inspectra_check_security_config` | Security | Detect framework security misconfigurations |
| `inspectra_parse_coverage` | Tests | Parse coverage reports |
| `inspectra_parse_test_results` | Tests | Parse JUnit XML results |
| `inspectra_detect_missing_tests` | Tests | Find untested source files |
| `inspectra_check_layering` | Architecture | Verify layer dependencies |
| `inspectra_analyze_dependencies` | Architecture | Analyze dependency health |
| `inspectra_check_naming` | Conventions | Verify naming patterns |
| `inspectra_check_file_lengths` | Conventions | Flag long files |
| `inspectra_check_todos` | Conventions | Find TODO/FIXME markers |
| `inspectra_check_function_lengths` | Conventions | Flag long functions/methods |
| `inspectra_check_param_counts` | Conventions | Flag functions with too many parameters |
| `inspectra_check_magic_numbers` | Conventions | Detect unnamed numeric constants |
| `inspectra_check_dead_exports` | Tech Debt | Find exported symbols never imported |
| `inspectra_detect_deprecated_apis` | Tech Debt | Detect deprecated framework API usage |
| `inspectra_detect_code_smells` | Tech Debt | Flag God classes, deep nesting, JPA anti-patterns, and missing DB migrations |
| `inspectra_merge_domain_reports` | Orchestrator | Merge and score reports |
| `inspectra_score_findings` | Orchestrator | Compute a domain score |
| `inspectra_render_html` | Report Engine | Render HTML report (Obsidian dark theme) |
| `inspectra_render_pdf` | Report Engine | Export HTML report to PDF (requires puppeteer) |
| `inspectra_render_trend` | Report Engine | Compute score trend from multiple reports |
| `inspectra_compare_reports` | Report Engine | Compare two reports and diff findings |
| `inspectra_log_activity` | Governance | Record agent activity to JSONL log |
| `inspectra_read_activity_log` | Governance | Read agent activity log entries |
| `inspectra_check_a11y_templates` | Accessibility | Detect a11y issues in HTML/Angular/JSX templates |
| `inspectra_check_rest_conventions` | API Design | Check REST route naming, versioning, HttpSession misuse, and pagination |
| `inspectra_check_observability` | Observability | Detect missing logging, tracing, health endpoints |
| `inspectra_check_i18n` | i18n | Detect hardcoded strings and missing i18n setup |
| `inspectra_check_ux_consistency` | UX Consistency | Detect design system violations and visual inconsistencies |
| `inspectra_generate_claude_md` | Adapter | Generate CLAUDE.md from Inspectra workflow assets |
| `inspectra_generate_codex_agents_md` | Adapter | Generate Codex AGENTS.md from Inspectra workflow assets |

### Technology Stack

- TypeScript (ES2022, Node 20+) for the MCP server
- JSON Schema (2020-12) for output validation
- Markdown + JSON for reports
- Zod for runtime type validation

### Tool Response Pagination

All finding tools return **paginated responses** to stay within the VS Code Copilot inline-response size budget (~10 KB). The default page size is 20 findings.

Every tool response includes:
```json
{ "findings": [...], "total": 87, "count": 20, "has_more": true, "next_offset": 20 }
```

**Workflows MUST paginate when `has_more` is `true`:**

1. Call the tool with default parameters → receive findings 0–19, `has_more: true`, `next_offset: 20`
2. Call the tool again with `offset: 20` → receive findings 20–39
3. Repeat until `has_more` is `false`
4. Merge all pages before building the domain report

Failing to paginate means findings beyond the first page are silently dropped from the audit. This is the most common cause of incomplete domain reports.

**Filtering to reduce page count:** Use severity or domain filters when available to reduce total findings before paginating (e.g., audit only `critical` and `high` severity first).

---

## Agent Governance (Stripe Minions Principles)

These rules apply to prompt workflows, automation, and contributors working with Inspectra.
Ref: https://stripe.dev/blog/minions-stripes-one-shot-end-to-end-coding-agents

### Rule #1 — Never Fix Bad Output

When a workflow produces incorrect, incomplete, or malformed output:

1. **Diagnose** — Identify the root cause (bad input? wrong tool? schema mismatch?)
2. **Reset** — Discard the bad output entirely
3. **Fix** — Correct the root cause (prompt, tool input, data)
4. **Re-run** — Execute the agent again from scratch

Do NOT patch, massage, or manually edit bad agent output. That hides the real problem.

### Hard Blocks

Automation MUST NEVER:
- Run `git push`, `git push --force`, or any remote-mutating git operation
- Delete files outside the target project scope
- Modify `schemas/` or `policies/` directories without explicit human approval
- Install new dependencies (`npm install`, `pip install`) without human confirmation
- Execute arbitrary shell commands that modify system state
- Produce partial reports when MCP tools are unavailable (fail fast, fail loud)

### Domain Scope

Each audit domain has a strict scope:

| Domain | IN scope | OUT of scope |
| ------- | ---------- | ------------- |
| security | Source code, config files, dependency manifests | Test fixtures, example files, docs |
| tests | Test files, coverage reports, test configs | Application source logic |
| architecture | Import graphs, module structure, dependency trees | Individual code quality |
| conventions | All source files for naming/style | Architectural decisions |
| performance | Build configs, bundle outputs, runtime code | Functional correctness |
| documentation | README, docs/, ADRs, inline API docs | Code logic |
| tech-debt | All source files for complexity, staleness metrics | Feature correctness |
| accessibility | HTML/Angular/JSX/TSX templates | Non-template source code, runtime behavior |
| api-design | Route definitions, controller files | Business logic, database queries |
| observability | Service files, config, error handling | Functional correctness, UI code |
| i18n | Templates, i18n config, translation files | Backend logic, non-user-facing strings |
| ux-consistency | Stylesheets, templates (inline styles), design tokens, theme files | Test files, generated files, docs, backend logic, accessibility |

If a workflow step encounters something outside its scope, it MUST ignore it — not report it.

### Task Decomposition

- A focused workflow is a correct workflow
- One domain, one report
- Workflows should NOT be given "epics" — break down into single-purpose tasks
- The merge step is the ONLY entity that composes multiple domain results

### The Pit of Success

- High-quality input tokens produce high-quality output
- Always provide structured, schema-validated data to workflow steps
- Never pass raw/unvalidated user input into domain synthesis — normalize first
- Code quality in the repo directly affects audit quality (clean code is easier to audit)

### Traceability

Every workflow action must be traceable:
- All domain reports include `metadata.agent`, `metadata.timestamp`, `metadata.tools_used`
- Every finding has `evidence` with file paths and line numbers
- The merge step records which domains were audited and their individual results
- Git commits from automation-assisted work should make the workflow clear in the commit message

### Standardization

- Prompt workflows should follow a predictable structure: mission, scope, workflow, output, and rules
- All domain outputs return JSON matching `schemas/domain-report.schema.json`
- All finding IDs follow `DOMAIN_PREFIX-XXX` pattern
- Tool names are always prefixed with `inspectra_`
- Workflows should not surprise you — predictable structure, predictable output

### Per-Agent Isolation

- Each agent operates independently with no shared mutable state
- Agents do NOT communicate with each other directly — only through the orchestrator
- An isolated agent is a safe agent — no side effects outside its report output
- If running agents in parallel, each should work on an isolated view of the codebase
