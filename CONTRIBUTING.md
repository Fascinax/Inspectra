# Contributing to Inspectra

Thanks for helping improve Inspectra.

This project combines Copilot Custom Agents, an MCP server, JSON Schema contracts, and policy-driven scoring. Small, focused pull requests are the easiest way to contribute safely.

## Before You Start

- Use Node.js 20+ and npm 10+
- Read the architecture overview in [docs/architecture.md](docs/architecture.md)
- Read the agent governance guide in [docs/agent-governance.md](docs/agent-governance.md)
- Keep changes scoped to one concern when possible: tool, agent, renderer, policy, or documentation

## Local Setup

```bash
git clone https://github.com/Fascinax/Inspectra.git
cd Inspectra
npm install
npm run build
npm test
```

## Common Commands

| Command | Purpose |
| --- | --- |
| `npm run build` | Build the MCP server in `mcp/dist/` |
| `npm run lint` | Type-check and lint TypeScript sources |
| `npm test` | Run the Vitest suite |
| `npm run test:coverage` | Run tests with coverage |
| `npm run validate:schemas` | Validate examples against JSON schemas |
| `make validate` | Run schema validation and agent linting |
| `make smoke` | Smoke-test the MCP server |
| `make bootstrap` | Install, build, and test in one pass |

> Note: some helper scripts use Bash. On Windows, run them from Git Bash, WSL, or another Bash-compatible shell.

## Project Layout

- `mcp/src/tools/` — domain tool implementations
- `mcp/src/register/` — MCP tool registration and schemas
- `mcp/src/merger/` — report merge, deduplication, scoring
- `schemas/` — JSON Schema contracts for findings and reports
- `policies/` — scoring, severity, deduplication, and stack profiles
- `.github/agents/` — domain agent definitions
- `.github/prompts/` — reusable audit entry points
- `docs/` — contributor and product documentation

## Contribution Workflows

### Adding or Updating an MCP Tool

1. Implement the logic in the appropriate file under `mcp/src/tools/`
2. Register the tool in `mcp/src/register/`
3. Reuse shared response helpers from `mcp/src/register/response.ts`
4. Add or update tests in `mcp/src/__tests__/`
5. Update related docs if the tool is user-facing

See [docs/adding-a-tool.md](docs/adding-a-tool.md) for the detailed flow.

### Adding or Updating an Agent

1. Keep each agent scoped to a single domain
2. Return schema-compliant JSON only
3. Keep tool-detected and LLM-detected findings within the documented ID and confidence ranges
4. Update any supporting documentation if the domain surface changes

See [docs/adding-an-agent.md](docs/adding-an-agent.md) for the detailed flow.

### Updating Policies or Schemas

Changes under `policies/`, `schemas/`, or `.github/agents/` have broad impact. Open an issue or discussion first unless the change is a targeted bug fix with clear justification.

## Quality Bar

All contributions should preserve these invariants:

- MCP tool names are prefixed with `inspectra_`
- Tool code lives in `mcp/src/tools/`; registration lives in `mcp/src/register/`
- Findings follow the contracts in [schemas/finding.schema.json](schemas/finding.schema.json)
- Tool-detected findings use `source: "tool"`, confidence `>= 0.8`, and IDs `001-499`
- LLM-detected findings use `source: "llm"`, confidence `<= 0.7`, and IDs `501+`
- Paginated tool responses must keep fetching until `has_more` is `false`
- Documentation should be updated when commands, workflows, or public behavior change

## Test Checklist

Before opening a pull request, run:

```bash
npm run build
npm run lint
npm test
npm run validate:schemas
bash scripts/lint-agents.sh
```

If your change affects rendering, configuration, or setup flows, also run the relevant smoke or manual verification step.

## Pull Request Checklist

- [ ] The change is focused and intentionally scoped
- [ ] Tests were added or updated when behavior changed
- [ ] Existing tests pass locally
- [ ] Documentation was updated for user-facing or contributor-facing changes
- [ ] `CHANGELOG.md` was updated when the change is notable
- [ ] Output examples or screenshots were added when they help reviewers validate the change

## Release Notes

Use the `Unreleased` section in [CHANGELOG.md](CHANGELOG.md) for notable changes. Keep entries short, factual, and grouped under `Added`, `Changed`, `Fixed`, or `Removed`.

## Release Workflow

- GitHub releases are automated by [.github/workflows/release.yml](.github/workflows/release.yml)
- Release tags should match the package version exactly, for example `v0.7.0`
- The workflow builds, tests, packs the npm artifact, uploads the tarball, and publishes to npm when `NPM_TOKEN` is configured

## Need More Context?

- [README.md](README.md)
- [docs/architecture.md](docs/architecture.md)
- [docs/agent-governance.md](docs/agent-governance.md)
- [docs/scoring-model.md](docs/scoring-model.md)
- [docs/roadmap.md](docs/roadmap.md)
