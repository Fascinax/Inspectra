# Agents

Inspectra uses GitHub Copilot Custom Agents to perform structured code audits.

## Agent Overview

| Agent | Domain | Tools | Finding Prefix |
|-------|--------|-------|---------------|
| [audit-orchestrator](.github/agents/audit-orchestrator.agent.md) | Coordination | `merge-domain-reports`, `score-findings` | - |
| [audit-security](.github/agents/audit-security.agent.md) | Security | `scan-secrets`, `check-deps-vulns`, `run-semgrep`, `check-maven-deps` | `SEC-` |
| [audit-tests](.github/agents/audit-tests.agent.md) | Tests | `parse-coverage`, `parse-test-results`, `detect-missing-tests`, `parse-playwright-report`, `detect-flaky-tests` | `TST-` |
| [audit-architecture](.github/agents/audit-architecture.agent.md) | Architecture | `check-layering`, `analyze-dependencies`, `detect-circular-deps` | `ARC-` |
| [audit-conventions](.github/agents/audit-conventions.agent.md) | Conventions | `check-naming`, `check-file-lengths`, `check-todos`, `parse-lint-output`, `detect-dry-violations` | `CNV-` |
| [audit-performance](.github/agents/audit-performance.agent.md) | Performance | `analyze-bundle-size`, `check-build-timings`, `detect-runtime-metrics` | `PRF-` |
| [audit-documentation](.github/agents/audit-documentation.agent.md) | Documentation | `check-readme-completeness`, `check-adr-presence`, `detect-doc-code-drift` | `DOC-` |
| [audit-tech-debt](.github/agents/audit-tech-debt.agent.md) | Tech debt | `analyze-complexity`, `age-todos`, `check-dependency-staleness` | `DEBT-` |

## How It Works

User prompt -> Orchestrator -> domain agents -> merge -> report

1. The orchestrator receives the audit request and decides which domains to audit.
2. It delegates to domain agents via handoffs.
3. Each domain agent calls MCP tools to gather findings.
4. Each domain agent returns a domain report JSON.
5. The orchestrator merges reports, deduplicates, scores, and generates Markdown output.

## Orchestrator

- Full audit (`/audit-full`): invokes all 7 domain agents.
- PR audit (`/audit-pr`): invokes only agents relevant to changed files.
- Targeted audit: invokes only the requested domain.

## Domain Reports

Each domain report must conform to `schemas/domain-report.schema.json`.
