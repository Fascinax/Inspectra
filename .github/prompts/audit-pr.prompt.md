---
description: "Audit only the files changed in a pull request"
agent: audit-orchestrator
---

Run a focused audit on the files changed in this pull request only.

## Workflow

1. Identify the changed files in the PR by reading the diff context provided in the conversation or using the `search` tool
2. Determine which domains are relevant based on the diff:
   - Auth, config, API, or secrets files changed → invoke `audit-security`
   - Source files with or without tests changed → invoke `audit-tests`
   - Module structure or import paths changed → invoke `audit-architecture`
   - Any source file changed → invoke `audit-conventions`
   - Build, bundle, or runtime config files changed → invoke `audit-performance`
   - Docs or README files changed → invoke `audit-documentation`
   - Legacy hotspots or TODO-heavy files changed → invoke `audit-tech-debt`
3. Pass only the changed file paths to each relevant agent
4. Call `inspectra/merge-domain-reports` with the collected domain reports
5. Produce a concise PR review report

## Scope Rules

- Only audit files that are part of the diff — do not scan the full project
- Minimum confidence threshold: `0.7` — skip low-confidence findings
- Skip `info`-level findings — focus on actionable issues only

## Output Format

```markdown
## Inspectra PR Audit

**Score**: XX/100 | **Findings**: X critical, X high, X medium

### Issues Found

| # | Severity | Domain | File | Title |
|---|----------|--------|------|-------|
| 1 | high | security | src/auth.ts | Hardcoded API key |

### Details
(for each finding: evidence with line, recommendation, effort)

### Verdict
(1-2 sentences — merge-ready or needs fixes)
```
