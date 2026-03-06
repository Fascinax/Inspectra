```prompt
---
description: "Audit a single domain on the target project"
agent: audit-orchestrator
---

Run a targeted audit on the project in the current workspace, covering **only one specified domain**.

## Workflow

1. Identify the requested domain from the `domain` parameter
2. Invoke the corresponding domain agent:
   - `security` → `audit-security`
   - `tests` → `audit-tests`
   - `architecture` → `audit-architecture`
   - `conventions` → `audit-conventions`
   - `performance` → `audit-performance`
   - `documentation` → `audit-documentation`
   - `tech-debt` → `audit-tech-debt`
3. Collect the domain report (conforming to `schemas/domain-report.schema.json`)
4. Call `inspectra_score_findings` to compute the domain score
5. Produce a focused Markdown report for this single domain

## Scoring

- Domain score: 0–100 (100 = no issues), penalties = severity_weight × confidence
- Grades: A (90+), B (75+), C (60+), D (40+), F (<40)

## Output Format

```markdown
## Inspectra Domain Audit — {Domain}

**Score**: XX/100 | **Grade**: X | **Findings**: X total (X critical, X high, X medium, X low)

### Findings

| # | Severity | File | Title |
| --- | ---------- | ------ | ------- |
| 1 | critical | src/config.ts | Hardcoded database password |

### Details
(for each finding: evidence with line, recommendation, effort)

### Summary
(2-3 sentences — domain health, top risks, recommended next steps)
```

```
