---
description: "[Benchmark] Tier A — Single-pass audit: all MCP tools + 1 LLM synthesis. No sub-agents."
---

> **Benchmark tier A** — This prompt is part of ADR-008 architecture benchmark. Do NOT modify.

Run a full code audit using **only deterministic MCP tools + a single LLM synthesis pass**. No sub-agents. No handoffs. No Phase 2 exploration.

## Workflow

### Step 1 — Run ALL deterministic tools

Call every applicable Inspectra MCP tool. **Paginate all tools**: when `has_more` is `true`, call again with the returned `next_offset` until `has_more` is `false`. Merge all pages per tool.

**Security tools:**
- `inspectra_scan_secrets` — hardcoded secrets detection
- `inspectra_check_deps_vulns` — npm/maven dependency vulnerabilities
- `inspectra_check_security_config` — framework security misconfigurations

**Test tools:**
- `inspectra_detect_missing_tests` — source files without corresponding test files

**Architecture tools:**
- `inspectra_check_layering` — layer dependency violations
- `inspectra_analyze_dependencies` — dependency health
- `inspectra_detect_circular_deps` — circular dependency detection

**Conventions tools:**
- `inspectra_check_naming` — naming pattern violations
- `inspectra_check_file_lengths` — oversized files
- `inspectra_check_function_lengths` — oversized functions
- `inspectra_check_param_counts` — functions with too many parameters
- `inspectra_check_magic_numbers` — unnamed numeric constants
- `inspectra_check_todos` — TODO/FIXME markers
- `inspectra_check_dead_exports` — exported symbols never imported

**Documentation tools:**
- `inspectra_check_readme_completeness` — README quality
- `inspectra_check_adr_presence` — ADR directory check
- `inspectra_detect_doc_code_drift` — documentation/code sync

**Tech debt tools:**
- `inspectra_analyze_complexity` — cyclomatic complexity hotspots
- `inspectra_check_dependency_staleness` — outdated dependencies
- `inspectra_detect_deprecated_apis` — deprecated framework API usage
- `inspectra_detect_code_smells` — god classes, deep nesting, JPA anti-patterns

**Accessibility tools:**
- `inspectra_check_a11y_templates` — WCAG violations in HTML/JSX/Angular templates

**API design tools:**
- `inspectra_check_rest_conventions` — REST route naming, versioning, session usage

**Observability tools:**
- `inspectra_check_observability` — swallowed exceptions, missing health endpoints, tracing gaps

**i18n tools:**
- `inspectra_check_i18n` — hardcoded strings, missing i18n setup

**UX consistency tools:**
- `inspectra_check_ux_consistency` — hardcoded colors, inline styles, inconsistent tokens

### Step 2 — Single LLM Synthesis

With ALL tool findings collected, perform ONE synthesis pass:

1. **Deduplicate**: Remove findings that describe the same issue in different words. Keep the one with the highest confidence.
2. **Cross-correlate**: Identify files that appear in findings from multiple domains — these are hotspots.
3. **Root cause analysis**: Group related findings that share a common root cause. For example:
   - Multiple hardcoded secrets → "No secret management strategy"
   - Multiple verb-based routes → "No REST convention guidelines"
   - Deep nesting + god class + long functions in same file → "SRP violation / god object"
4. **Rank**: Sort by impact. A root cause that explains 5 symptoms is more important than an isolated finding.
5. **Score**: Call `inspectra_score_findings` for each domain that has findings.
6. **Merge**: Call `inspectra_merge_domain_reports` with all domain results.

### Step 3 — Produce report

Output a Markdown report following the format below.

## Rules

- **Do NOT** invoke any sub-agents or handoffs
- **Do NOT** read source code files manually for Phase 2 exploration — rely solely on tool outputs
- **Do** paginate all tool calls when `has_more` is `true`
- **Do** call tools that return no findings — absence of findings is data (the domain scores 100)
- **Do** include all domains in the report, even those with 0 findings

## Output Format

```markdown
## Inspectra Audit — Tier A (Single-Pass)

**Score**: XX/100 | **Grade**: X | **Findings**: X critical, X high, X medium, X low
**Architecture**: Tier A — All tools + 1 LLM synthesis | **Run**: YYYY-MM-DD HH:mm

### Domain Scores

| Domain | Score | Grade | Findings |
| -------- | ------- | ------- | ---------- |
| Security | XX/100 | X | X findings |
| ... | ... | ... | ... |

### Root Causes (ranked by impact)

| # | Root Cause | Affected Domains | Symptom Count | Top Recommendation |
|---|-----------|-----------------|---------------|-------------------|
| 1 | No secret management | security | 3 | Move secrets to env vars |

### Top Findings

| # | Severity | Domain | File | Title | Root Cause |
| --- | ---------- | -------- | ------ | ------- | ---------- |
| 1 | critical | security | src/config.ts | Hardcoded JWT secret | RC-001 |

### Hotspot Files

| File | Domains | Finding Count | Assessment |
|------|---------|--------------|------------|
| src/config.ts | security, conventions | 3 | High-priority refactor target |

### Summary
(2-3 sentences)
```
