---
description: "Audit only the files changed in a pull request"
---

> Architecture: **Tier B (Hybrid)** scoped to PR diff — see [ADR-008](../../evaluations/benchmark-results.md).

Run a focused audit on the files changed in this pull request only, using the Tier B hybrid workflow.

## Workflow

### Step 1 — Identify Changed Files

Identify the changed files in the PR by reading the diff context provided in the conversation or using the `search` tool. Build a list of changed file paths.

### Step 2 — Determine Relevant Tool Groups

Based on the changed file types, select which MCP tools to run:

| Changed file pattern | Tool group |
|---------------------|------------|
| Auth, config, API, or secrets files | Security: `inspectra_scan_secrets`, `inspectra_check_deps_vulns`, `inspectra_check_security_config` |
| Source files (with or without tests) | Tests: `inspectra_detect_missing_tests` |
| Module structure or import paths | Architecture: `inspectra_check_layering`, `inspectra_analyze_dependencies`, `inspectra_detect_circular_deps` |
| Any source file | Conventions: `inspectra_check_naming`, `inspectra_check_file_lengths`, `inspectra_check_function_lengths`, `inspectra_check_param_counts`, `inspectra_check_magic_numbers`, `inspectra_check_todos` |
| Build, bundle, or runtime config | Performance: `inspectra_analyze_bundle_size`, `inspectra_check_build_timings` |
| Docs or README | Documentation: `inspectra_check_readme_completeness`, `inspectra_check_adr_presence`, `inspectra_detect_doc_code_drift` |
| Legacy hotspots or TODO-heavy files | Tech debt: `inspectra_analyze_complexity`, `inspectra_check_dependency_staleness`, `inspectra_detect_deprecated_apis`, `inspectra_detect_code_smells` |
| HTML/Angular/JSX templates | Accessibility: `inspectra_check_a11y_templates` |
| Route definitions, controllers | API design: `inspectra_check_rest_conventions` |
| Service files, error handling, logging | Observability: `inspectra_check_observability` |
| Templates, translation files, i18n config | i18n: `inspectra_check_i18n` |
| Stylesheets, design tokens, templates with inline styles | UX consistency: `inspectra_check_ux_consistency` |

### Step 3 — Run Selected Tools

Run only the selected MCP tools. **Paginate all tools**: when `has_more` is `true`, call again with the returned `next_offset` until `has_more` is `false`.

### Step 4 — Hotspot Detection (PR-scoped)

Compute hotspot files among the **changed files only**: files with 3+ findings from 2+ domains. If hotspots are found, read each file and look for deeper issues (root causes, design-level problems, logic flaws). Produce explorer findings with `source: "llm"`, `confidence ≤ 0.7`, IDs starting at 501.

### Step 5 — Score & Report

1. Call `inspectra_score_findings` for each relevant domain
2. Call `inspectra_merge_domain_reports` with all domain results
3. Produce a concise PR review report

## Scope Rules

- Only audit files that are part of the diff — do not scan the full project
- Minimum confidence threshold: `0.7` — skip low-confidence findings
- Skip `info`-level findings — focus on actionable issues only

## Rules

- **Do NOT** invoke domain sub-agents — all analysis happens in this single prompt
- **Do** paginate all tool calls when `has_more` is `true`
- Only report findings for files in the PR diff

## Output Format

```markdown
## Inspectra PR Audit

**Score**: XX/100 | **Findings**: X critical, X high, X medium
**Architecture**: Tier B (Hybrid) | **Changed files**: X | **Explorer triggered**: Yes/No

### Issues Found

| # | Severity | Domain | File | Title | Source |
| --- | ---------- | -------- | ------ | ------- | -------- |
| 1 | high | security | src/auth.ts | Hardcoded API key | tool |

### Details
(for each finding: evidence with line, recommendation, effort)

### Verdict
(1-2 sentences — merge-ready or needs fixes)
```
