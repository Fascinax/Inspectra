# Inspectra — Global Copilot Instructions

## Project Overview

Inspectra is a multi-agent code audit system. It uses specialized Copilot agents coordinated by an orchestrator to perform structured audits across security, tests, architecture, and conventions domains.

## Architecture

- **Agents** (`.github/agents/`): Copilot Custom Agents with domain expertise.
- **MCP Server** (`mcp/`): TypeScript server exposing audit tools via Model Context Protocol.
- **Schemas** (`schemas/`): JSON Schema contracts for findings and reports.
- **Policies** (`policies/`): Scoring rules, severity matrix, and stack-specific profiles.
- **Prompts** (`.github/prompts/`): Reusable entry points for common audit workflows.

## Critical Rules

### Output Format

All agents MUST return structured JSON following the schemas in `schemas/`. Never return free-form text as the primary output. The orchestrator is the only agent that produces the final Markdown report.

### Finding Contract

Every finding MUST include:
- `id`: Pattern `DOMAIN_PREFIX-XXX` (e.g., `SEC-001`, `TST-042`)
- `severity`: One of `critical`, `high`, `medium`, `low`, `info`
- `domain`: The audit domain that produced it
- `rule`: Machine-readable rule identifier
- `confidence`: Float between 0.0 and 1.0
- `evidence`: At least one file path

### Scoring

- Domain scores range from 0 to 100 (100 = no issues).
- Overall score is a weighted average: security 30%, tests 25%, architecture 20%, conventions 15%, other 10%.
- Grades: A (90+), B (75+), C (60+), D (40+), F (<40).

### MCP Tools

Tools are registered in the `inspectra` MCP server. Agents should call them by prefixed name (e.g., `inspectra/scan-secrets`). Available tools:

| Tool | Domain | Purpose |
|------|--------|---------|
| `scan-secrets` | Security | Detect hardcoded secrets |
| `check-deps-vulns` | Security | npm audit for vulnerabilities |
| `parse-coverage` | Tests | Parse coverage reports |
| `parse-test-results` | Tests | Parse JUnit XML results |
| `detect-missing-tests` | Tests | Find untested source files |
| `check-layering` | Architecture | Verify layer dependencies |
| `analyze-dependencies` | Architecture | Analyze dependency health |
| `check-naming` | Conventions | Verify naming patterns |
| `check-file-lengths` | Conventions | Flag long files |
| `check-todos` | Conventions | Find TODO/FIXME markers |
| `merge-domain-reports` | Orchestrator | Merge and score reports |
| `score-findings` | Orchestrator | Compute a domain score |

### Technology Stack

- TypeScript (ES2022, Node 20+) for the MCP server
- JSON Schema (2020-12) for output validation
- Markdown + JSON for reports
- Zod for runtime type validation
