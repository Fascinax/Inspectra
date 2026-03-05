# Inspectra

**Multi-agent code audit system** powered by GitHub Copilot Custom Agents and MCP.

Inspectra coordinates specialized audit agents — security, tests, architecture, conventions, performance, documentation, tech-debt, accessibility, api-design, observability, and i18n — to produce structured, scored, and actionable code quality reports.

---

## Installation

```bash
# Clone the repository
git clone https://github.com/Fascinax/Inspectra.git
cd Inspectra

# Install dependencies
npm install

# Build the MCP server
npm run build

# Install globally
npm install -g .
```

---

## Quick Start

### Prerequisites

- Node.js 20+
- npm 10+
- GitHub Copilot with Custom Agents support

### Option A — Global Setup (recommended, zero project footprint)

```bash
inspectra setup
```

This installs everything into your VS Code user directory:*

- MCP server registered in VS Code user settings
- Agents + prompts available globally in all projects

Then open **any** project in VS Code → Copilot Chat → type `/audit`.

No files are added to your projects.

### Option B — Per-project (symlinks, gitignored)

```bash
inspectra init /path/to/my-project
```

This creates symlinked agents in the target project (gitignored automatically):

- `.github/agents/` — agents visible in the Copilot dropdown (symlinked, gitignored)
- `.github/prompts/` — audit prompt shortcuts (symlinked, gitignored)
- `.vscode/mcp.json` — MCP server auto-starts when the project opens
- `policies/` + `schemas/` — scoring rules and contracts (copied)

On Windows, directory junctions are used (no Developer Mode or elevation required). File symlinks are used on Unix.

### Option C — Per-project (committed copies)

```bash
inspectra init /path/to/my-project --copy
```

Same as Option B but files are real copies committed with the repo. Useful for CI or when team members don't have Inspectra installed.

### Run an Audit

Open the target project in VS Code, open Copilot Chat, and type:

- `/audit` : full audit (all 11 domains, agent selected automatically)
- `/audit-pr` : audit scoped to changed files

---

## Project Structure

```markdown
inspectra/
├─ .github/
│  ├─ agents/           # Copilot Custom Agent profiles
│  │  ├─ audit-orchestrator.agent.md
│  │  ├─ audit-security.agent.md
│  │  ├─ audit-tests.agent.md
│  │  ├─ audit-architecture.agent.md
│  │  ├─ audit-conventions.agent.md
│  │  ├─ audit-performance.agent.md
│  │  ├─ audit-documentation.agent.md
│  │  ├─ audit-tech-debt.agent.md
│  │  ├─ audit-accessibility.agent.md
│  │  ├─ audit-api-design.agent.md
│  │  ├─ audit-observability.agent.md
│  │  └─ audit-i18n.agent.md
│  ├─ prompts/          # Reusable prompt files
│  │  ├─ audit.prompt.md
│  │  └─ audit-pr.prompt.md
│  ├─ workflows/        # GitHub Actions CI/CD
│  │  └─ validate-config.yml   # Build, test & validate on push/PR
│  └─ copilot-instructions.md
│
├─ mcp/                 # MCP server (TypeScript)
│  └─ src/
│     ├─ index.ts       # Server entry point
│     ├─ types.ts       # Zod schemas & TypeScript types
│     ├─ tools/
│     │  ├─ security.ts        # inspectra_scan_secrets, inspectra_check_deps_vulns
│     │  ├─ tests.ts           # inspectra_parse_coverage, inspectra_parse_test_results, inspectra_detect_missing_tests
│     │  ├─ architecture.ts    # inspectra_check_layering, inspectra_analyze_dependencies
│     │  ├─ conventions.ts     # inspectra_check_naming, inspectra_check_file_lengths, inspectra_check_todos
│     │  ├─ performance.ts     # inspectra_analyze_bundle_size, inspectra_check_build_timings
│     │  ├─ documentation.ts   # inspectra_check_readme_completeness, inspectra_check_adr_presence
│     │  ├─ tech-debt.ts       # inspectra_analyze_complexity, inspectra_age_todos
│     │  ├─ accessibility.ts   # inspectra_check_a11y_templates
│     │  ├─ api-design.ts      # inspectra_check_rest_conventions
│     │  ├─ observability.ts   # inspectra_check_observability
│     │  ├─ i18n.ts            # inspectra_check_i18n
│     │  └─ adapter.ts         # inspectra_generate_claude_md
│     ├─ merger/
│     │  ├─ merge-findings.ts  # inspectra_merge_domain_reports tool
│     │  ├─ deduplicate.ts     # Deduplication logic
│     │  └─ score.ts           # Scoring engine
│     ├─ register/      # Tool registration modules
│     ├─ policies/      # Policy loader & scoring defaults
│     └─ utils/         # Shared utilities (files, paths, project-config)
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
│     ├─ angular-frontend.yml
│     └─ typescript-node.yml
│
├─ scripts/             # Dev & CI utility scripts
│  ├─ bootstrap.sh
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
│  ├─ adding-a-tool.md
│  ├─ adding-an-agent.md
│  ├─ output-format.md
│  ├─ scoring-model.md
│  ├─ agent-governance.md
│  └─ roadmap.md
│
├─ Makefile             # Unified command runner
└─ bin/init.mjs         # Copy agents into a target project
```

---

## Docker

### MCP Server

```bash
docker compose up inspectra
```

---

## Audit Domains

| Domain | Agent | MCP Tools | Prefix |
| -------- | ------- | ----------- | -------- |
| Security | `audit-security` | `inspectra_scan_secrets`, `inspectra_check_deps_vulns`, `inspectra_run_semgrep`, `inspectra_check_maven_deps` | `SEC-` |
| Tests | `audit-tests` | `inspectra_parse_coverage`, `inspectra_parse_test_results`, `inspectra_detect_missing_tests`, `inspectra_parse_playwright_report`, `inspectra_detect_flaky_tests` | `TST-` |
| Architecture | `audit-architecture` | `inspectra_check_layering`, `inspectra_analyze_dependencies`, `inspectra_detect_circular_deps` | `ARC-` |
| Conventions | `audit-conventions` | `inspectra_check_naming`, `inspectra_check_file_lengths`, `inspectra_check_todos`, `inspectra_parse_lint_output`, `inspectra_detect_dry_violations` | `CNV-` |
| Performance | `audit-performance` | `inspectra_analyze_bundle_size`, `inspectra_check_build_timings`, `inspectra_detect_runtime_metrics` | `PRF-` |
| Documentation | `audit-documentation` | `inspectra_check_readme_completeness`, `inspectra_check_adr_presence`, `inspectra_detect_doc_code_drift` | `DOC-` |
| Tech debt | `audit-tech-debt` | `inspectra_analyze_complexity`, `inspectra_age_todos`, `inspectra_check_dependency_staleness` | `DEBT-` |
| Accessibility | `audit-accessibility` | `inspectra_check_a11y_templates` | `ACC-` |
| API Design | `audit-api-design` | `inspectra_check_rest_conventions` | `API-` |
| Observability | `audit-observability` | `inspectra_check_observability` | `OBS-` |
| i18n | `audit-i18n` | `inspectra_check_i18n` | `INT-` |

---

## Scoring Model

- **Domain scores**: 0–100 (100 = no issues)
- **Overall score**: Weighted average across all audited domains (weights in `policies/scoring-rules.yml`)
- **Grades**: A (90+), B (75+), C (60+), D (40+), F (<40)

---

## Make Commands

| Command | Description |
| --------- | ------------- |
| `make bootstrap` | Full setup: install, build, test |
| `make build` | Build the MCP server |
| `make test` | Run unit tests |
| `make validate` | Validate schemas + lint agents |
| `make smoke` | Smoke test the MCP server |
| `make init TARGET=/path` | Copy agents into a project |
| `make help` | List all commands |

## npm Scripts

| Script | Description |
| -------- | ------------- |
| `npm run build` | Compile the MCP server (TypeScript → `mcp/dist/`) |
| `npm test` | Run 346 unit + integration tests (Vitest) |
| `npm run test:watch` | Run tests in watch mode |
| `npm run test:coverage` | Run tests with V8 coverage report |
| `npm run lint` | TypeScript type-check + ESLint |
| `npm run lint:fix` | Auto-fix ESLint violations |
| `npm run format` | Format source with Prettier |
| `npm run format:check` | Check Prettier formatting (CI-safe) |

---

## Testing

```bash
# Run the full test suite
npm test

# Watch mode for development
npm run test:watch

# Generate coverage report
npm run test:coverage
```

Tests are written with [Vitest](https://vitest.dev/) and live alongside source files in `mcp/src/__tests__/`.

---

## Extending

- **Add a tool**: See [docs/adding-a-tool.md](docs/adding-a-tool.md)
- **Add an agent**: See [docs/adding-an-agent.md](docs/adding-an-agent.md)
- **Architecture guide**: See [docs/architecture.md](docs/architecture.md)
- **Output formats**: See [docs/output-format.md](docs/output-format.md)
- **Scoring model**: See [docs/scoring-model.md](docs/scoring-model.md)
- **Roadmap**: See [docs/roadmap.md](docs/roadmap.md)
- **Add a domain**: Create a new agent in `.github/agents/`, add tools in `mcp/src/tools/`, update scoring weights
- **Add a profile**: Create a YAML file in `policies/profiles/`

### Available Profiles

| Profile | Stack |
| --------- | ------- |
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
