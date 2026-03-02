---
description: "Run a full multi-domain audit on the target project"
agent: audit-orchestrator
---

Run a comprehensive code audit on the project in the current workspace, covering all 7 domains.

## Workflow

1. Invoke **all** domain agents in parallel:
   - `audit-security` — secrets, dependency vulnerabilities, auth issues
   - `audit-tests` — coverage, test results, missing tests, flaky tests
   - `audit-architecture` — layering violations, circular deps, dependency health
   - `audit-conventions` — naming, file lengths, TODOs, lint, DRY
   - `audit-performance` — bundle size, build timings, runtime metrics
   - `audit-documentation` — README completeness, ADRs, doc-code drift
   - `audit-tech-debt` — complexity, stale TODOs, dependency staleness
2. Collect all domain reports (each conforming to `schemas/domain-report.schema.json`)
3. Call `inspectra/merge-domain-reports` with the collected domain reports
4. Produce a consolidated Markdown report

## Scoring

- Domain scores: 0–100 (100 = no issues), penalties = severity_weight × confidence
- Overall score: weighted average — security 30%, tests 25%, architecture 20%, conventions 15%, performance 5%, documentation 5%
- Grades: A (90+), B (75+), C (60+), D (40+), F (<40)

## Output Format

```markdown
## Inspectra Full Audit

**Score**: XX/100 | **Grade**: X | **Findings**: X critical, X high, X medium, X low

### Domain Scores

| Domain | Score | Grade | Findings |
|--------|-------|-------|----------|
| Security | XX/100 | X | X findings |
| Tests | XX/100 | X | X findings |
| Architecture | XX/100 | X | X findings |
| Conventions | XX/100 | X | X findings |
| Performance | XX/100 | X | X findings |
| Documentation | XX/100 | X | X findings |
| Tech Debt | XX/100 | X | X findings |

### Top Findings

| # | Severity | Domain | File | Title |
|---|----------|--------|------|-------|
| 1 | critical | security | src/config.ts | Hardcoded database password |

### Details
(for each finding: evidence with line, recommendation, effort)

### Summary
(2-3 sentences — overall health, top risks, recommended next steps)
```
