---
description: "[Benchmark] Tier B — Hybrid audit: all MCP tools + structured domain analysis + conditional explorer for hotspots."
---

> **Benchmark tier B** — This prompt is part of ADR-008 architecture benchmark. Do NOT modify.

Run a full code audit using **deterministic MCP tools + structured single-prompt domain analysis + a conditional explorer for hotspot files**. This is a hybrid between Tier A (pure tools) and Tier C (full multi-agent).

## Workflow

### Step 1 — Run ALL deterministic tools

Identical to Tier A. Call every applicable Inspectra MCP tool. **Paginate all tools**: when `has_more` is `true`, call again with the returned `next_offset` until `has_more` is `false`. Merge all pages per tool.

**Security:** `inspectra_scan_secrets`, `inspectra_check_deps_vulns`, `inspectra_check_security_config`
**Tests:** `inspectra_detect_missing_tests`
**Architecture:** `inspectra_check_layering`, `inspectra_analyze_dependencies`, `inspectra_detect_circular_deps`
**Conventions:** `inspectra_check_naming`, `inspectra_check_file_lengths`, `inspectra_check_function_lengths`, `inspectra_check_param_counts`, `inspectra_check_magic_numbers`, `inspectra_check_todos`, `inspectra_check_dead_exports`
**Documentation:** `inspectra_check_readme_completeness`, `inspectra_check_adr_presence`, `inspectra_detect_doc_code_drift`
**Tech debt:** `inspectra_analyze_complexity`, `inspectra_check_dependency_staleness`, `inspectra_detect_deprecated_apis`, `inspectra_detect_code_smells`
**Accessibility:** `inspectra_check_a11y_templates`
**API design:** `inspectra_check_rest_conventions`
**Observability:** `inspectra_check_observability`
**i18n:** `inspectra_check_i18n`
**UX consistency:** `inspectra_check_ux_consistency`

### Step 2 — Hotspot Detection

After collecting all tool findings, compute **hotspot files**: files that appear in **3 or more findings from 2 or more distinct domains**.

Build a hotspot table:

```
File → { domains: Set<string>, findings: Finding[], score: domains.size * findings.length }
```

Sort by score descending. The top 5 hotspot files (if any qualify) will be explored in Step 3.

### Step 3 — Conditional Deep Explorer

**Only if hotspot files were found in Step 2**, read each hotspot file and perform targeted analysis:

For each hotspot file:
1. Read the full file content
2. Cross-reference the tool findings that flagged this file
3. Look for **deeper issues** that tools could not detect:
   - Are the tool findings symptoms of a single root cause?
   - Are there design-level problems (SRP violations, missing abstraction, wrong pattern choice)?
   - Are there security issues that regex-based tools miss (logic flaws, auth bypass, race conditions)?
   - Are there performance anti-patterns (N+1 queries, unbounded iterations, sync I/O in hot paths)?
4. Produce additional explorer findings with:
   - `source: "llm"`, `confidence: ≤ 0.7`, IDs starting at 501
   - Evidence with specific line numbers from the file

**If NO hotspot files qualify** (no file has 3+ findings from 2+ domains), skip Step 3 entirely. This is expected for clean codebases — the tool layer alone is sufficient.

### Step 4 — Structured Domain Synthesis

With all tool findings AND any explorer findings, perform a single structured analysis pass organized by domain:

For EACH domain that has findings:
1. **Group** findings by root cause
2. **Assess** whether the findings represent real actionable issues or noise
3. **Identify** any cross-domain correlations (e.g., missing tests + swallowed exceptions = reliability risk)
4. **Score**: Call `inspectra_score_findings` for each domain

Then:
5. **Merge**: Call `inspectra_merge_domain_reports` with all domain results
6. **Rank**: Prioritize root causes over individual symptoms

### Step 5 — Produce report

Output a Markdown report following the format below.

## Rules

- **Do NOT** invoke any sub-agents for domain analysis — all domain analysis happens in this single prompt
- **Do** invoke the explorer (Step 3) ONLY when hotspot detection triggers it
- **Do** paginate all tool calls when `has_more` is `true`
- **Do** call tools that return no findings — absence of findings is data
- **Do** include all domains in the report
- **Do** clearly label explorer findings as `source: llm` and tool findings as `source: tool`

## Output Format

```markdown
## Inspectra Audit — Tier B (Hybrid)

**Score**: XX/100 | **Grade**: X | **Findings**: X critical, X high, X medium, X low
**Architecture**: Tier B — Tools + structured analysis + conditional explorer | **Run**: YYYY-MM-DD HH:mm
**Explorer triggered**: Yes/No | **Hotspot files explored**: X

### Domain Scores

| Domain | Score | Grade | Findings (tool) | Findings (explorer) |
| -------- | ------- | ------- | ----------------- | --------------------- |
| Security | XX/100 | X | X | X |
| ... | ... | ... | ... | ... |

### Hotspot Files

| File | Domains | Tool Findings | Explorer Findings | Root Cause |
|------|---------|--------------|-------------------|------------|
| src/app.ts | security, conventions, tech-debt | 5 | 2 | God object / SRP violation |

### Root Causes (ranked by impact)

| # | Root Cause | Affected Domains | Symptom Count | Source | Top Recommendation |
|---|-----------|-----------------|---------------|--------|-------------------|
| 1 | No secret management | security | 3 | tool | Move secrets to env vars |
| 2 | God object (app.ts) | tech-debt, conventions, observability | 5 | explorer | Decompose into modules |

### Top Findings

| # | Severity | Domain | File | Title | Source | Root Cause |
| --- | ---------- | -------- | ------ | ------- | -------- | ---------- |
| 1 | critical | security | src/config.ts | Hardcoded JWT secret | tool | RC-001 |
| 2 | high | tech-debt | src/app.ts | SRP violation — god class | explorer | RC-002 |

### Explorer Analysis (if triggered)

For each explored hotspot file:
- File path
- Why it was explored (which tool findings triggered it)
- What the explorer found (deeper issues, root causes, design-level observations)
- Confidence assessment

### Summary
(2-3 sentences)
```
