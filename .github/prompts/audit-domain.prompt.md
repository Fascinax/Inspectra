---
description: "Audit a single domain on the target project"
---

Run a targeted audit on the project in the current workspace, covering **only one specified domain** with MCP tools and optional hotspot exploration.

## Workflow

1. Identify the requested domain from the `domain` parameter
2. Run the corresponding MCP tools for that domain:
   - `security` → `inspectra_scan_secrets`, `inspectra_check_deps_vulns`, `inspectra_check_security_config`
   - `tests` → `inspectra_detect_missing_tests`, `inspectra_parse_coverage`, `inspectra_parse_test_results`, `inspectra_parse_playwright_report`, `inspectra_detect_flaky_tests`, `inspectra_check_test_quality`
   - `architecture` → `inspectra_check_layering`, `inspectra_analyze_dependencies`, `inspectra_detect_circular_deps`
   - `conventions` → `inspectra_check_naming`, `inspectra_check_file_lengths`, `inspectra_check_todos`, `inspectra_parse_lint_output`, `inspectra_detect_dry_violations`, `inspectra_check_function_lengths`, `inspectra_check_param_counts`, `inspectra_check_magic_numbers`
   - `performance` → `inspectra_analyze_bundle_size`, `inspectra_check_build_timings`, `inspectra_detect_runtime_metrics`
   - `documentation` → `inspectra_check_readme_completeness`, `inspectra_check_adr_presence`, `inspectra_detect_doc_code_drift`, `inspectra_detect_env_example_drift`
   - `tech-debt` → `inspectra_analyze_complexity`, `inspectra_age_todos`, `inspectra_check_dependency_staleness`, `inspectra_check_dead_exports`, `inspectra_detect_deprecated_apis`, `inspectra_detect_code_smells`
   - `accessibility` → `inspectra_check_a11y_templates`
   - `api-design` → `inspectra_check_rest_conventions`
   - `observability` → `inspectra_check_observability`
   - `i18n` → `inspectra_check_i18n`
   - `ux-consistency` → `inspectra_check_ux_consistency`
3. Paginate any tool with `has_more: true` until all findings are collected
4. If the domain has hotspot files, optionally read them and add explorer findings with `source: "llm"`, `confidence ≤ 0.7`, IDs starting at 501
5. Call `inspectra_score_findings` to compute the domain score
6. Produce a focused Markdown report for this single domain

## Scoring

- Domain score: 0–100 (100 = no issues), penalties = severity_weight × confidence
- Grades: A (90+), B (75+), C (60+), D (40+), F (<40)

## Output Format

```markdown
## Inspectra Domain Audit — {Domain}

**Score**: XX/100 | **Grade**: X | **Findings**: X total (X critical, X high, X medium, X low)
**Source Split**: X tool, X explorer

### Findings

| # | Severity | File | Title | Source |
| --- | ---------- | ------ | ------- | -------- |
| 1 | critical | src/config.ts | Hardcoded database password | tool |

### Details
(for each finding: evidence with line, recommendation, effort)

### Summary
(2-3 sentences — domain health, top risks, recommended next steps)
```
