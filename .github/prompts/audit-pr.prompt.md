---
description: "Audit only the files changed in a pull request"
---

# PR Audit

Run a focused audit on the files changed in the current pull request.

## Instructions

Use the `audit-orchestrator` agent with a reduced scope:

1. Identify the changed files in the PR.
2. Determine which audit domains are relevant based on changed files:
   - Changed auth/config/API files → invoke `audit-security`
   - Changed test files or source files with tests → invoke `audit-tests`
   - Changed module structure or imports → invoke `audit-architecture`
   - Any changed source files → invoke `audit-conventions`
3. Pass only the changed file paths to each agent.
4. Merge results and produce a focused PR report.

## Scope Rules

- Only audit files that are part of the diff.
- Reduce noise: use `confidence >= 0.7` as the minimum threshold for findings.
- Skip `info`-level findings for PR reviews.
- Focus on **actionable** issues the PR author can fix immediately.

## Expected Output

A concise Markdown report suitable as a PR comment:

```markdown
## Inspectra PR Audit

**Score**: XX/100 | **Findings**: X issues

### Issues Found

| # | Severity | Domain | File | Title |
|---|----------|--------|------|-------|
| 1 | high     | security | src/auth.ts | Hardcoded API key |

### Details

(for each finding: title, evidence, recommendation)

### Summary

(1-2 sentences on overall PR quality)
```
