# Agents

Inspectra uses GitHub Copilot Custom Agents to perform structured code audits. Each agent has a specific domain of expertise and returns findings in a standardized JSON format.

## Agent Overview

| Agent | Domain | Tools | Finding Prefix |
|-------|--------|-------|---------------|
| [audit-orchestrator](.github/agents/audit-orchestrator.agent.md) | Coordination | `merge-domain-reports`, `score-findings` | — |
| [audit-security](.github/agents/audit-security.agent.md) | Security | `scan-secrets`, `check-deps-vulns` | `SEC-` |
| [audit-tests](.github/agents/audit-tests.agent.md) | Tests | `parse-coverage`, `parse-test-results`, `detect-missing-tests` | `TST-` |
| [audit-architecture](.github/agents/audit-architecture.agent.md) | Architecture | `check-layering`, `analyze-dependencies` | `ARC-` |
| [audit-conventions](.github/agents/audit-conventions.agent.md) | Conventions | `check-naming`, `check-file-lengths`, `check-todos` | `CNV-` |

## How It Works

```
User (prompt) → Orchestrator → [Security, Tests, Architecture, Conventions] → Merge → Report
```

1. The **orchestrator** receives the audit request and decides which domains to audit.
2. It delegates to **domain agents** via handoffs.
3. Each domain agent calls its **MCP tools** to gather findings.
4. Each agent returns a **domain report** (JSON).
5. The orchestrator **merges** all reports, **deduplicates**, **scores**, and produces the final **Markdown report**.

## Orchestrator

The orchestrator does not perform audits itself. It coordinates, collects, and consolidates. It determines audit scope based on the request:

- **Full audit** (`/audit-full`): Invokes all 4 domain agents.
- **PR audit** (`/audit-pr`): Invokes only agents relevant to changed files.
- **Targeted audit**: Invokes only the requested domain.

## Domain Agents

Each domain agent:
- Has a defined set of MCP tools it can call.
- Analyzes the codebase from its domain perspective.
- Returns structured JSON conforming to `schemas/domain-report.schema.json`.
- Never returns free-form text as primary output.

### Security Agent

Scans for hardcoded secrets, API keys, vulnerable dependencies, SQL injection vectors, XSS risks, and authentication gaps.

### Tests Agent

Evaluates test coverage metrics, parses JUnit test results for failures, detects source files without tests, and flags test hygiene issues (skipped tests, no assertions).

### Architecture Agent

Checks clean architecture layer violations, analyzes dependency health, detects excessive coupling, and evaluates project structure consistency.

### Conventions Agent

Verifies naming patterns (files, classes, methods), flags overly long files, finds unresolved TODO/FIXME comments, and checks coding style consistency.

## Adding a New Agent

See [docs/adding-an-agent.md](docs/adding-an-agent.md).
