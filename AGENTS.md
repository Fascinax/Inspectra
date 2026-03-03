# Agents

Inspectra uses GitHub Copilot Custom Agents to perform structured code audits.

## Agent Overview

| Agent | Domain | Tools | Finding Prefix |
|-------|--------|-------|---------------|
| [audit-orchestrator](.github/agents/audit-orchestrator.agent.md) | Coordination | `inspectra_merge_domain_reports`, `inspectra_score_findings` | - |
| [audit-security](.github/agents/audit-security.agent.md) | Security | `inspectra_scan_secrets`, `inspectra_check_deps_vulns`, `inspectra_run_semgrep`, `inspectra_check_maven_deps` | `SEC-` |
| [audit-tests](.github/agents/audit-tests.agent.md) | Tests | `inspectra_parse_coverage`, `inspectra_parse_test_results`, `inspectra_detect_missing_tests`, `inspectra_parse_playwright_report`, `inspectra_detect_flaky_tests` | `TST-` |
| [audit-architecture](.github/agents/audit-architecture.agent.md) | Architecture | `inspectra_check_layering`, `inspectra_analyze_dependencies`, `inspectra_detect_circular_deps` | `ARC-` |
| [audit-conventions](.github/agents/audit-conventions.agent.md) | Conventions | `inspectra_check_naming`, `inspectra_check_file_lengths`, `inspectra_check_todos`, `inspectra_parse_lint_output`, `inspectra_detect_dry_violations` | `CNV-` |
| [audit-performance](.github/agents/audit-performance.agent.md) | Performance | `inspectra_analyze_bundle_size`, `inspectra_check_build_timings`, `inspectra_detect_runtime_metrics` | `PRF-` |
| [audit-documentation](.github/agents/audit-documentation.agent.md) | Documentation | `inspectra_check_readme_completeness`, `inspectra_check_adr_presence`, `inspectra_detect_doc_code_drift` | `DOC-` |
| [audit-tech-debt](.github/agents/audit-tech-debt.agent.md) | Tech debt | `inspectra_analyze_complexity`, `inspectra_age_todos`, `inspectra_check_dependency_staleness` | `DEBT-` |

## How It Works

User prompt -> Orchestrator -> domain agents -> merge -> report

1. The orchestrator receives the audit request and decides which domains to audit.
2. It delegates to domain agents via handoffs.
3. Each domain agent calls MCP tools to gather findings.
4. Each domain agent returns a domain report JSON.
5. The orchestrator merges reports, deduplicates, scores, and generates Markdown output.

## Orchestrator

- Full audit (`/audit-full`): invokes all 7 domain agents.
- PR audit (`/audit-pr`): invokes only agents relevant to changed files.
- Targeted audit: invokes only the requested domain.

## Domain Reports

Each domain report must conform to `schemas/domain-report.schema.json`.
