<p align="center">
  <img src="banner.png" alt="Inspectra Banner" width="100%"/>
</p>

<h1 align="center">Inspectra</h1>

![GitHub Copilot](https://img.shields.io/badge/GitHub_Copilot-000000?style=for-the-badge&logo=github&logoColor=white)
![Claude Code](https://img.shields.io/badge/Claude_Code-D97757?style=for-the-badge&logo=anthropic&logoColor=white)
![OpenAI Codex](https://img.shields.io/badge/OpenAI_Codex-412991?style=for-the-badge&logo=openai&logoColor=white)

[![Validate Config](https://github.com/Fascinax/Inspectra/actions/workflows/validate-config.yml/badge.svg?branch=main)](https://github.com/Fascinax/Inspectra/actions/workflows/validate-config.yml)
[![npm version](https://img.shields.io/npm/v/inspectra?style=for-the-badge&logo=npm)](https://www.npmjs.com/package/inspectra)
![Tests](https://img.shields.io/badge/tests-652%20passing-2ea043?style=for-the-badge)

**Multi-agent code audit system** powered by GitHub Copilot Custom Agents and MCP.

Inspectra coordinates specialized audit agents — security, tests, architecture, conventions, performance, documentation, tech-debt, accessibility, api-design, observability, and i18n — to produce structured, scored, and actionable code quality reports.

## Supported Languages

### Full support (Phase 1 tools + Phase 2 LLM)

![TypeScript](https://img.shields.io/badge/TypeScript-3178C6?style=for-the-badge&logo=typescript&logoColor=white)
![JavaScript](https://img.shields.io/badge/JavaScript-F7DF1E?style=for-the-badge&logo=javascript&logoColor=black)
![Java](https://img.shields.io/badge/Java-ED8B00?style=for-the-badge&logo=openjdk&logoColor=white)

### Partial support (Phase 2 LLM only)

![Python](https://img.shields.io/badge/Python-3776AB?style=flat-square&logo=python&logoColor=white)
![Go](https://img.shields.io/badge/Go-00ADD8?style=flat-square&logo=go&logoColor=white)
![Kotlin](https://img.shields.io/badge/Kotlin-7F52FF?style=flat-square&logo=kotlin&logoColor=white)
![C#](https://img.shields.io/badge/C%23-239120?style=flat-square&logo=csharp&logoColor=white)
![PHP](https://img.shields.io/badge/PHP-777BB4?style=flat-square&logo=php&logoColor=white)
![Ruby](https://img.shields.io/badge/Ruby-CC342D?style=flat-square&logo=ruby&logoColor=white)
![Swift](https://img.shields.io/badge/Swift-F05138?style=flat-square&logo=swift&logoColor=white)

> **Full support** = deterministic MCP tool scans (naming, file lengths, complexity, DRY, etc.) + LLM code exploration.
> **Partial support** = LLM exploration only — no tool-detected findings. More languages on the [roadmap](docs/roadmap.md).


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

### Option A′ — Claude Code Setup

```bash
cd /path/to/my-project
inspectra setup --claude
```

This creates in the current directory:

- `.mcp.json` — Claude Code auto-connects to the Inspectra MCP server
- `CLAUDE.md` — project context with audit instructions, tool list, scoring model
- `policies/` + `schemas/` — scoring rules and contracts

Then open the project with Claude Code and ask to run an audit.

See [docs/claude-code-setup.md](docs/claude-code-setup.md) for detailed instructions.

### Option A″ — OpenAI Codex Setup

```bash
cd /path/to/my-project
inspectra setup --codex
```

This creates in the current directory:

- `AGENTS.md` — Codex reads this as project instructions (audit workflow, tools, scoring)
- `.codex/config.toml` — MCP server configuration (Codex auto-connects)
- `policies/` + `schemas/` — scoring rules and contracts

Then run `codex "Run a full Inspectra audit on this project."`

See [docs/codex-setup.md](docs/codex-setup.md) for detailed instructions.

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

- `/audit` : full audit (all 12 domains, agent selected automatically)
- `/audit-pr` : audit scoped to changed files

---

## Usage

### Running Audits

**Full audit** (all 12 domains):

```markdown
/audit
```

**PR audit** (only changed files):

```markdown
/audit-pr
```

**Domain-specific audit**:

```markdown
@audit-security Audit security vulnerabilities in this project
@audit-tests Analyze test coverage and quality
@audit-architecture Review project architecture and dependencies
@audit-conventions Check code conventions and style
@audit-performance Analyze bundle sizes and performance
@audit-documentation Review documentation completeness
@audit-tech-debt Identify technical debt hotspots
@audit-accessibility Check WCAG compliance and ARIA attributes
@audit-api-design Review REST API conventions
@audit-observability Check logging, tracing, and health endpoints
@audit-i18n Verify internationalization setup
```

### Working with Reports

**Generate HTML report**:

```bash
inspectra render report.json --html
```

**Export to PDF**:

```bash
inspectra render report.json --pdf
```

**Compare reports**:

```bash
inspectra compare baseline.json current.json
```

**View trends**:

```bash
inspectra trend report1.json report2.json report3.json
```

### CLI Commands

| Command | Description |
| --------- | ------------- |
| `inspectra setup` | Global setup (VS Code user settings) |
| `inspectra setup --claude` | Claude Code setup (current directory) |
| `inspectra setup --codex` | OpenAI Codex setup (current directory) |
| `inspectra init <path>` | Per-project setup with symlinks |
| `inspectra init <path> --copy` | Per-project setup with copies |
| `inspectra doctor` | Diagnose installation issues |

### Environment Variables

| Variable | Default | Description |
| ---------- | --------- | ------------- |
| `INSPECTRA_LOG_LEVEL` | `info` | Log verbosity (`debug`, `info`, `warn`, `error`) |
| `INSPECTRA_PROFILE` | `generic` | Active policy profile |
| `NODE_ENV` | `production` | Runtime environment |

### Profile Selection

Profiles are auto-detected based on package.json and pom.xml. Explicit override:

```json
{
  "inspectra": {
    "profile": "java-angular-playwright"
  }
}
```

Or via environment:

```bash
export INSPECTRA_PROFILE=java-backend
```

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
| `npm test` | Run the Vitest suite |
| `npm run test:watch` | Run tests in watch mode |
| `npm run test:coverage` | Run tests with V8 coverage report |
| `npm run lint` | TypeScript type-check + ESLint |
| `npm run lint:fix` | Auto-fix ESLint violations |
| `npm run format` | Format source with Prettier |
| `npm run format:check` | Check Prettier formatting (CI-safe) |
| `npm run release:check` | Run the npm publication preflight (`npm publish --dry-run`) |

---

## Release Checklist

Before publishing a new version:

1. Bump the version in [package.json](package.json) and update [CHANGELOG.md](CHANGELOG.md)
2. Run `npm run release:check`
3. Create a GitHub release tag matching the package version, for example `v0.7.0`
4. Ensure the `NPM_TOKEN` repository secret is configured
5. Publish via the release workflow in [.github/workflows/release.yml](.github/workflows/release.yml)

The release workflow builds, tests, packs the artifact, publishes with npm provenance, and attaches the tarball to the GitHub release.

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

- **Contributing guide**: See [CONTRIBUTING.md](CONTRIBUTING.md)
- **Release notes**: See [CHANGELOG.md](CHANGELOG.md)
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
