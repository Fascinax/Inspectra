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
# Install dependencies
npm install

# Build the MCP server
npm run build

# Verify it works
node mcp/dist/index.js
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
│  └─ consolidated-report.schema.json
│
├─ policies/            # Scoring rules & stack profiles
│  ├─ severity-matrix.yml
│  ├─ scoring-rules.yml
│  └─ profiles/
│     └─ java-angular-playwright.yml
│
├─ examples/            # Sample outputs
│  ├─ findings/
│  └─ reports/
│
└─ docs/                # Documentation
   ├─ architecture.md
   └─ adding-a-tool.md
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

## Extending

- **Add a tool**: See [docs/adding-a-tool.md](docs/adding-a-tool.md)
- **Add a domain**: Create a new agent in `.github/agents/`, add tools in `mcp/src/tools/`, update scoring weights
- **Add a profile**: Create a YAML file in `policies/profiles/`

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
