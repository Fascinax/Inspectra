# Inspectra — Global Copilot Instructions

## Project Overview

Inspectra is a multi-agent code audit system. It uses specialized Copilot agents coordinated by an orchestrator to perform structured audits across 11 domains: security, tests, architecture, conventions, performance, documentation, tech-debt, accessibility, api-design, observability, and i18n.

## Architecture

- **Agents** (`.github/agents/`): Copilot Custom Agents with domain expertise.
- **MCP Server** (`mcp/`): TypeScript server exposing audit tools via Model Context Protocol.
- **Schemas** (`schemas/`): JSON Schema contracts for findings and reports.
- **Policies** (`policies/`): Scoring rules, severity matrix, and stack-specific profiles.
- **Prompts** (`.github/prompts/`): Reusable entry points for common audit workflows.

## Critical Rules

### Output Format

All agents MUST return structured JSON following the schemas in `schemas/`. Never return free-form text as the primary output. The orchestrator is the only agent that produces the final Markdown report.

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
- Overall score is a weighted average of audited domain scores. Core weights: security 24%, tests 20%, architecture 16%, conventions 12%, performance 10%, documentation 8%, tech-debt 10%. Extended weights (v0.7+): accessibility 8%, api-design 7%, observability 6%, i18n 5%. Weights are re-normalized at runtime based on which domains were actually audited.
- Only domains actually audited contribute to the weighted average.
- Reference `policies/scoring-rules.yml` for authoritative values.
- Grades: A (90+), B (75+), C (60+), D (40+), F (<40).

### MCP Tools

Tools are registered in the `inspectra` MCP server. Agents should call them by prefixed name (e.g., `inspectra_scan_secrets`). Available tools:

| Tool | Domain | Purpose |
|------|--------|---------|
| `inspectra_scan_secrets` | Security | Detect hardcoded secrets |
| `inspectra_check_deps_vulns` | Security | npm audit for vulnerabilities |
| `inspectra_parse_coverage` | Tests | Parse coverage reports |
| `inspectra_parse_test_results` | Tests | Parse JUnit XML results |
| `inspectra_detect_missing_tests` | Tests | Find untested source files |
| `inspectra_check_layering` | Architecture | Verify layer dependencies |
| `inspectra_analyze_dependencies` | Architecture | Analyze dependency health |
| `inspectra_check_naming` | Conventions | Verify naming patterns |
| `inspectra_check_file_lengths` | Conventions | Flag long files |
| `inspectra_check_todos` | Conventions | Find TODO/FIXME markers |
| `inspectra_merge_domain_reports` | Orchestrator | Merge and score reports |
| `inspectra_score_findings` | Orchestrator | Compute a domain score |
| `inspectra_render_html` | Report Engine | Render HTML report (Obsidian dark theme) |
| `inspectra_render_pdf` | Report Engine | Export HTML report to PDF (requires puppeteer) |
| `inspectra_render_trend` | Report Engine | Compute score trend from multiple reports |
| `inspectra_compare_reports` | Report Engine | Compare two reports and diff findings |
| `inspectra_log_activity` | Governance | Record agent activity to JSONL log |
| `inspectra_read_activity_log` | Governance | Read agent activity log entries |
| `inspectra_check_a11y_templates` | Accessibility | Detect a11y issues in HTML/Angular/JSX templates |
| `inspectra_check_rest_conventions` | API Design | Check REST route naming and versioning |
| `inspectra_check_observability` | Observability | Detect missing logging, tracing, health endpoints |
| `inspectra_check_i18n` | i18n | Detect hardcoded strings and missing i18n setup |
| `inspectra_generate_claude_md` | Adapter | Generate CLAUDE.md from agent definitions |

### Technology Stack

- TypeScript (ES2022, Node 20+) for the MCP server
- JSON Schema (2020-12) for output validation
- Markdown + JSON for reports
- Zod for runtime type validation

---

## Agent Governance (Stripe Minions Principles)

These rules apply to ALL agents and ALL contributors working with agents.
Ref: https://stripe.dev/blog/minions-stripes-one-shot-end-to-end-coding-agents

### Rule #1 — Never Fix Bad Output

When an agent produces incorrect, incomplete, or malformed output:

1. **Diagnose** — Identify the root cause (bad input? wrong tool? schema mismatch?)
2. **Reset** — Discard the bad output entirely
3. **Fix** — Correct the root cause (prompt, tool input, data)
4. **Re-run** — Execute the agent again from scratch

Do NOT patch, massage, or manually edit bad agent output. That hides the real problem.

### Hard Blocks

Agents MUST NEVER:
- Run `git push`, `git push --force`, or any remote-mutating git operation
- Delete files outside the target project scope
- Modify `.github/agents/`, `schemas/`, or `policies/` directories without explicit human approval
- Install new dependencies (`npm install`, `pip install`) without human confirmation
- Execute arbitrary shell commands that modify system state
- Produce partial reports when MCP tools are unavailable (fail fast, fail loud)

### Agent Scope

Each domain agent has a strict scope:

| Agent | IN scope | OUT of scope |
|-------|----------|-------------|
| audit-security | Source code, config files, dependency manifests | Test fixtures, example files, docs |
| audit-tests | Test files, coverage reports, test configs | Application source logic |
| audit-architecture | Import graphs, module structure, dependency trees | Individual code quality |
| audit-conventions | All source files for naming/style | Architectural decisions |
| audit-performance | Build configs, bundle outputs, runtime code | Functional correctness |
| audit-documentation | README, docs/, ADRs, inline API docs | Code logic |
| audit-tech-debt | All source files for complexity, staleness metrics | Feature correctness |
| audit-accessibility | HTML/Angular/JSX/TSX templates | Non-template source code, runtime behavior |
| audit-api-design | Route definitions, controller files | Business logic, database queries |
| audit-observability | Service files, config, error handling | Functional correctness, UI code |
| audit-i18n | Templates, i18n config, translation files | Backend logic, non-user-facing strings |

If an agent encounters something outside its scope, it MUST ignore it — not report it.

### Task Decomposition

- A focused agent is a correct agent
- One agent, one domain, one report
- Agents should NOT be given "epics" — break down into single-purpose tasks
- The orchestrator is the ONLY entity that composes multiple agent results

### The Pit of Success

- High-quality input tokens produce high-quality output
- Always provide structured, schema-validated data to agents
- Never pass raw/unvalidated user input to domain agents — the orchestrator normalizes first
- Code quality in the repo directly affects audit quality (clean code is easier to audit)

### Traceability

Every agent action must be traceable:
- All domain reports include `metadata.agent`, `metadata.timestamp`, `metadata.tools_used`
- Every finding has `evidence` with file paths and line numbers
- The orchestrator records which agents were invoked and their individual results
- Git commits from agent-assisted work must include the agent name in the commit message trailer

### Standardization

- All agents follow the same prompt structure: Mission → What You Audit → Workflow → Output Format → Severity Guide → MCP Prerequisite → Rules
- All agents return JSON matching `schemas/domain-report.schema.json`
- All finding IDs follow `DOMAIN_PREFIX-XXX` pattern
- Tool names are always prefixed with `inspectra_`
- Agents should not surprise you — predictable structure, predictable output

### Per-Agent Isolation

- Each agent operates independently with no shared mutable state
- Agents do NOT communicate with each other directly — only through the orchestrator
- An isolated agent is a safe agent — no side effects outside its report output
- If running agents in parallel, each should work on an isolated view of the codebase
