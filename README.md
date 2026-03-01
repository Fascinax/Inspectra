# Inspectra

**Multi-agent code audit system** powered by GitHub Copilot Custom Agents and MCP.

Inspectra coordinates specialized audit agents — security, tests, architecture, conventions — to produce structured, scored, and actionable code quality reports.

---

## Quick Start

### Prerequisites

- Node.js 20+
- npm 10+
- GitHub Copilot with Custom Agents support

### Setup

```bash
# Full setup (install + build + test)
make bootstrap

# Or step by step
npm install
npm run build
npm test
```

### Run an Audit

1. Open the project to audit in VS Code.
2. In Copilot Chat, select the `audit-orchestrator` agent.
3. Use the `audit-full` prompt or type your request.

Alternatively, use prompt files:
- `/audit-full` — Full multi-domain audit
- `/audit-pr` — Focused PR audit

---

## Project Structure

```
inspectra/
├─ .github/
│  ├─ agents/           # Copilot Custom Agent profiles
│  │  ├─ audit-orchestrator.agent.md
│  │  ├─ audit-security.agent.md
│  │  ├─ audit-tests.agent.md
│  │  ├─ audit-architecture.agent.md
│  │  └─ audit-conventions.agent.md
│  ├─ prompts/          # Reusable prompt files
│  │  ├─ audit-full.prompt.md
│  │  └─ audit-pr.prompt.md
│  ├─ workflows/        # GitHub Actions CI/CD
│  │  ├─ validate-config.yml   # Build, test & validate on push/PR
│  │  ├─ run-audit-on-pr.yml   # Audit scope comment on PRs
│  │  └─ publish-report.yml    # Manual report generation
│  └─ copilot-instructions.md
│
├─ mcp/                 # MCP server (TypeScript)
│  └─ src/
│     ├─ index.ts       # Server entry point (12 tools registered)
│     ├─ types.ts       # Zod schemas & TypeScript types
│     ├─ tools/
│     │  ├─ security.ts      # scan-secrets, check-deps-vulns
│     │  ├─ tests.ts         # parse-coverage, parse-test-results, detect-missing-tests
│     │  ├─ architecture.ts  # check-layering, analyze-dependencies
│     │  └─ code-quality.ts  # check-naming, check-file-lengths, check-todos
│     └─ merger/
│        ├─ merge-findings.ts  # merge-domain-reports tool
│        ├─ deduplicate.ts     # Deduplication logic
│        └─ score.ts           # Scoring engine
│
├─ schemas/             # JSON Schema contracts
│  ├─ finding.schema.json
│  ├─ domain-report.schema.json
│  ├─ consolidated-report.schema.json
│  └─ scoring.schema.json
│
├─ policies/            # Scoring rules & stack profiles
│  ├─ severity-matrix.yml
│  ├─ scoring-rules.yml
│  ├─ deduplication-rules.yml
│  ├─ confidence-rules.yml
│  └─ profiles/
│     ├─ generic.yml
│     ├─ java-angular-playwright.yml
│     ├─ java-backend.yml
│     └─ angular-frontend.yml
│
├─ scripts/             # Dev & CI utility scripts
│  ├─ bootstrap.sh
│  ├─ run-local-audit.sh
│  ├─ validate-schemas.sh
│  ├─ lint-agents.sh
│  └─ smoke-test-mcp.sh
│
├─ examples/            # Sample outputs
│  ├─ findings/
│  └─ reports/
│
├─ docs/                # Documentation
│  ├─ architecture.md
│  └─ adding-a-tool.md
│
├─ Makefile             # Unified command runner
└─ bin/init.mjs         # Copy agents into a target project
```

---

## CLI Usage

Run audits locally without Copilot using the built-in CLI:

```bash
# Audit the current directory
npx inspectra-audit . --profile=generic --format=markdown

# Audit a specific project with JSON output
npx inspectra-audit /path/to/project --profile=java-angular-playwright --format=json --output=report.json

# Generate SARIF for CI integration
npx inspectra-audit . --format=sarif --output=results.sarif
```

### Output Formats

| Format | Flag | Use Case |
|--------|------|----------|
| Markdown | `--format=markdown` | Human-readable reports (default) |
| JSON | `--format=json` | Machine-readable, CI pipelines |
| SARIF | `--format=sarif` | GitHub Code Scanning, IDE integration |

---

## Docker

### MCP Server

```bash
docker compose up inspectra
```

### Run an Audit

```bash
TARGET_PROJECT=/path/to/project PROFILE=generic FORMAT=markdown \
  docker compose run audit
```

---

## Audit Domains

| Domain | Agent | MCP Tools | Prefix |
|--------|-------|-----------|--------|
| Security | `audit-security` | `scan-secrets`, `check-deps-vulns` | `SEC-` |
| Tests | `audit-tests` | `parse-coverage`, `parse-test-results`, `detect-missing-tests` | `TST-` |
| Architecture | `audit-architecture` | `check-layering`, `analyze-dependencies` | `ARC-` |
| Conventions | `audit-conventions` | `check-naming`, `check-file-lengths`, `check-todos` | `CNV-` |

---

## Scoring Model

- **Domain scores**: 0–100 (100 = no issues)
- **Overall score**: Weighted average (security 30%, tests 25%, architecture 20%, conventions 15%, other 10%)
- **Grades**: A (90+), B (75+), C (60+), D (40+), F (<40)

---

## Make Commands

| Command | Description |
|---------|-------------|
| `make bootstrap` | Full setup: install, build, test |
| `make build` | Build the MCP server |
| `make test` | Run unit tests |
| `make validate` | Validate schemas + lint agents |
| `make smoke` | Smoke test the MCP server |
| `make audit-local TARGET=/path PROFILE=generic` | Run local audit |
| `make init TARGET=/path` | Copy agents into a project |
| `make help` | List all commands |

---

## Extending

- **Add a tool**: See [docs/adding-a-tool.md](docs/adding-a-tool.md)
- **Architecture guide**: See [docs/architecture.md](docs/architecture.md)
- **Add a domain**: Create a new agent in `.github/agents/`, add tools in `mcp/src/tools/`, update scoring weights
- **Add a profile**: Create a YAML file in `policies/profiles/`

### Available Profiles

| Profile | Stack |
|---------|-------|
| `generic` | Any project (conservative defaults) |
| `java-angular-playwright` | Java + Angular + Playwright full-stack |
| `java-backend` | Java backend (Quarkus / Spring Boot) |
| `angular-frontend` | Angular SPA (TypeScript) |

---

## Tech Stack

- **TypeScript** (ES2022, Node 20+) — MCP server
- **Zod** — Runtime type validation
- **JSON Schema 2020-12** — Output contracts
- **MCP SDK** — Tool registration and transport
- **YAML** — Policies and profiles

---

## License

MIT
