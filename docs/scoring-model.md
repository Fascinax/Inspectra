# Scoring Model

This document explains how Inspectra computes domain scores, the overall score, and letter grades.

## Domain Score

Each domain starts at **100** (perfect). Findings reduce the score via penalties.

```
penalty = severity_weight × confidence
domain_score = max(0, 100 - sum(penalties))
```

### Severity Weights

| Severity | Weight | Example Impact |
| ---------- | -------- | ---------------- |
| Critical | 25 | A single critical finding with confidence 1.0 drops the score by 25 points |
| High | 15 | Two high findings at 0.8 confidence = -24 points |
| Medium | 8 | |
| Low | 3 | |
| Info | 0 | No impact on score |

These weights are defined in `policies/scoring-rules.yml` and implemented in `mcp/src/merger/score.ts`.

### Confidence Factor

Confidence acts as a multiplier. A finding with confidence 0.5 has half the penalty of one with confidence 1.0. This prevents uncertain detections from unfairly penalizing a project.

## Overall Score

The overall score is a **weighted average** of domain scores:

```
overall_score = Σ(domain_score × domain_weight) / Σ(domain_weight)
```

### Domain Weights

| Domain | Weight | Rationale |
| -------- | -------- | ----------- |
| Security | 30% | Vulnerabilities have the highest production impact |
| Tests | 25% | Test quality predicts reliability |
| Architecture | 20% | Structural issues compound over time |
| Conventions | 15% | Consistency aids long-term maintainability |
| Performance | 5% | Reserved for future domain |
| Documentation | 5% | Reserved for future domain |

Only domains actually audited contribute to the weighted average. If you run a security-only audit, the overall score equals the security score.

## Grades

| Grade | Min Score | Label | Meaning |
| ------- | ----------- | ------- | --------- |
| A | 90 | Excellent | Production-ready with minor or no issues |
| B | 75 | Good | Solid codebase with some areas to improve |
| C | 60 | Acceptable | Functional but has notable quality gaps |
| D | 40 | Poor | Significant issues across multiple domains |
| F | 0 | Critical | Major risks present, requires immediate attention |

## Deduplication

Before scoring, findings are deduplicated to avoid double-counting:

1. A **deduplication key** is built from `rule + evidence[0].file + evidence[0].line`.
2. If two findings share the same key, the one with **higher confidence** is kept.
3. Cross-domain aliases (defined in `policies/deduplication-rules.yml`) map equivalent rules to a canonical form.

## Confidence Filtering

Findings are filtered by confidence before inclusion:

| Context | Minimum Confidence |
| --------- | ------------------- |
| Full report | 0.3 |
| PR comment | 0.7 |
| Auto-dismiss | < 0.2 |

These thresholds are defined in `policies/confidence-rules.yml`.

## Profiles

Stack-specific profiles in `policies/profiles/` can override:
- Coverage thresholds
- File length limits
- Naming conventions
- Architecture layer definitions
- Security patterns

Available profiles: `generic`, `java-angular-playwright`, `java-backend`, `angular-frontend`.

## Implementation

The scoring engine lives in `mcp/src/merger/score.ts`:

- `scoreDomain(findings)` → computes a single domain's score
- `computeOverallScore(domainReports)` → weighted average
- `deriveGrade(score)` → letter grade lookup
