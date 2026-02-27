---
description: "Run a full multi-domain audit on the target project"
---

# Full Audit

Run a comprehensive code audit covering all domains: **security**, **tests**, **architecture**, and **conventions**.

## Target

Audit the project in the current workspace.

## Instructions

Use the `audit-orchestrator` agent to coordinate the full audit.

The orchestrator should:
1. Invoke `audit-security` to scan for secrets, vulnerabilities, and security anti-patterns
2. Invoke `audit-tests` to analyze coverage, test failures, and missing tests
3. Invoke `audit-architecture` to check layer violations and dependency health
4. Invoke `audit-conventions` to verify naming, file lengths, and tech debt markers
5. Merge all domain reports using `merge-domain-reports`
6. Produce a consolidated Markdown report

## Context

- Policy profile: `java-angular-playwright` (adjust based on detected stack)
- Severity matrix: see [severity-matrix.yml](../../policies/severity-matrix.yml)
- Scoring rules: see [scoring-rules.yml](../../policies/scoring-rules.yml)
- Output schemas: see [schemas/](../../schemas/)

## Expected Output

A single Markdown report including:
- Executive summary with overall score and grade
- Domain score table
- Top 10 priority findings
- Per-domain detailed findings
- Prioritized recommendations
