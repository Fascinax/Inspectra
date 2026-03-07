# ADR-004: Weighted scoring engine

## Status

Accepted

## Context

Inspectra audits up to 12 domains. Producing a single overall score requires combining domain scores in a meaningful way. A simple average treats security and i18n as equal—which does not reflect engineering risk. Different project stacks also have different emphasis (a backend-only service has no UX consistency domain to audit).

## Decision

The scoring engine applies a weighted average over audited domains only:

1. Each domain has a base weight defined in `policies/scoring-rules.yml`.
2. At runtime, only domains that were actually audited (i.e., returned a domain report) contribute to the average.
3. The weights of audited domains are re-normalised to sum to 1.0 before computing the final score.
4. Score penalties for individual findings are applied per domain using the severity matrix (`policies/severity-matrix.yml`): each finding reduces the raw domain score by a penalty proportional to its severity and confidence.
5. The final domain score is clamped to [0, 100].
6. Grades map to score bands: A (≥90), B (≥75), C (≥60), D (≥40), F (<40).

The implementation lives in `mcp/src/merger/` and is exposed via the `inspectra_merge_domain_reports` and `inspectra_score_findings` MCP tools.

## Consequences

- Running a partial audit (e.g., security + tests only) still yields a meaningful, correctly normalised score.
- Adding a new domain only requires adding its weight to the YAML; the scoring engine re-normalises automatically.
- Agents MUST NOT hardcode scoring weights—all values come from the loaded policy.
- The weighted model introduces subjectivity in weight values; these are calibrated from industry benchmarks and subject to review per release.
