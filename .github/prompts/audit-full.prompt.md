---
description: "Run a full multi-domain audit on the target project"
agent: audit-orchestrator
---

Run a comprehensive code audit on the project in the current workspace, covering all domains: **security**, **tests**, **architecture**, and **conventions**.

## Workflow

1. Delegate to `audit-security` — scan secrets, vulnerable dependencies, security anti-patterns
2. Delegate to `audit-tests` — analyze coverage, test failures, missing tests
3. Delegate to `audit-architecture` — check layer violations and dependency health
4. Delegate to `audit-conventions` — verify naming, file lengths, TODO/FIXME markers
5. Call `inspectra/merge-domain-reports` with all domain reports
6. Produce the final consolidated Markdown report

## Policy Context

- Scoring rules: #file:../../policies/scoring-rules.yml
- Severity matrix: #file:../../policies/severity-matrix.yml
- Profile: `java-angular-playwright` (adapt to detected stack)

## Output Format

A Markdown report with:
- Executive summary: overall score, grade, finding counts
- Domain score table (security, tests, architecture, conventions)
- Top 10 priority findings with file references and recommendations
- Per-domain detailed findings grouped by severity
- Prioritized action plan
