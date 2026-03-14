# Agents

Inspectra uses MCP tools and prompt workflows to perform structured code audits. `AGENTS.md` exists for Codex-compatible project instructions, not to declare runtime domain agents.

## Workflow Overview

User prompt -> MCP tool scan -> hotspot detection -> optional explorer -> merge -> report

1. The prompt workflow receives the audit request and selects the relevant tool groups.
2. MCP tools gather deterministic findings across the requested domains.
3. Hotspot detection identifies files with clustered findings across multiple domains.
4. A conditional explorer pass reads only hotspot files to uncover deeper root causes.
5. Root-cause inference maps hotspots to known categories (god-module, test-gap, etc.).
6. The prioritization engine scores each cluster and groups them into Fix Now / Next Sprint / Backlog.
7. The workflow merges results, simulates score projections, and generates Markdown output.

## Audit Modes

- Full audit (`/audit`): runs Tier B across all 12 domains.
- PR audit (`/audit-pr`): runs the Tier B workflow only on changed files.
- Targeted audit (`/audit-domain`): runs only the requested domain tool group.

## Domain Tool Groups

| Domain | Tool Group | Finding Prefix |
| ------- | ---------- | --------------- |
| Security | `inspectra_scan_secrets`, `inspectra_check_deps_vulns`, `inspectra_run_semgrep`, `inspectra_check_maven_deps`, `inspectra_check_security_config` | `SEC-` |
| Tests | `inspectra_parse_coverage`, `inspectra_parse_test_results`, `inspectra_detect_missing_tests`, `inspectra_parse_playwright_report`, `inspectra_detect_flaky_tests`, `inspectra_check_test_quality` | `TST-` |
| Architecture | `inspectra_check_layering`, `inspectra_analyze_dependencies`, `inspectra_detect_circular_deps` | `ARC-` |
| Conventions | `inspectra_check_naming`, `inspectra_check_file_lengths`, `inspectra_check_todos`, `inspectra_parse_lint_output`, `inspectra_detect_dry_violations`, `inspectra_check_function_lengths`, `inspectra_check_param_counts`, `inspectra_check_magic_numbers` | `CNV-` |
| Performance | `inspectra_analyze_bundle_size`, `inspectra_check_build_timings`, `inspectra_detect_runtime_metrics` | `PRF-` |
| Documentation | `inspectra_check_readme_completeness`, `inspectra_check_adr_presence`, `inspectra_detect_doc_code_drift`, `inspectra_detect_env_example_drift` | `DOC-` |
| Tech debt | `inspectra_analyze_complexity`, `inspectra_age_todos`, `inspectra_check_dependency_staleness`, `inspectra_check_dead_exports`, `inspectra_detect_deprecated_apis`, `inspectra_detect_code_smells` | `DEBT-` |
| Accessibility | `inspectra_check_a11y_templates` | `ACC-` |
| API Design | `inspectra_check_rest_conventions` | `API-` |
| Observability | `inspectra_check_observability` | `OBS-` |
| i18n | `inspectra_check_i18n` | `INT-` |
| UX Consistency | `inspectra_check_ux_consistency` | `UX-` |

## How It Works

User prompt -> MCP tool scan -> hotspot detection -> optional explorer -> merge -> report

1. The prompt workflow receives the audit request and decides which domains or tool groups to run.
2. MCP tools gather deterministic findings across the relevant domains.
3. Hotspot detection identifies files with clustered findings across multiple domains.
4. A conditional explorer pass reads only hotspot files to uncover deeper root causes.
5. Root-cause inference maps hotspots to known categories (god-module, test-gap, etc.).
6. The prioritization engine scores each cluster and groups them into Fix Now / Next Sprint / Backlog.
7. The workflow merges results, simulates score projections, and generates Markdown output.

## Orchestrator

- Full audit (`/audit`): runs Tier B across all 12 domains.
- PR audit (`/audit-pr`): runs the Tier B workflow only on changed files.
- Targeted audit (`/audit-domain`): runs only the requested domain's tool group.

## Domain Reports

Each domain report must conform to `schemas/domain-report.schema.json`.

## Pagination

All finding tools return paginated responses (default page size: 20). Every response includes `has_more` and `next_offset`. **Always paginate when `has_more: true`** — call the tool again with the returned `next_offset` until `has_more: false`, then merge all pages. Skipping pagination silently drops findings beyond the first page.
