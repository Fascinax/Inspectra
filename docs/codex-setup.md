# OpenAI Codex Setup

This guide explains how to use Inspectra with [OpenAI Codex](https://developers.openai.com/codex) — the coding agent that runs in your terminal, IDE, or as the Codex web app.

## Prerequisites

- **Node.js 20+** — [nodejs.org](https://nodejs.org)
- **Codex CLI** — installed via `npm install -g @openai/codex` or `brew install --cask codex`
- **Inspectra** — cloned and built

## Quick Start

```bash
# 1. Clone and build Inspectra
git clone <repo-url> ~/inspectra
cd ~/inspectra
npm install && npm run build

# 2. Set up your project for Codex
cd /path/to/my-project
node ~/inspectra/bin/init.mjs setup --codex
```

This creates:

| File | Purpose |
| ------ | --------- |
| `.codex/config.toml` | MCP server configuration (Codex reads this at startup) |
| `AGENTS.md` | Project instructions with audit workflow and tool reference |
| `policies/` | Scoring rules and severity matrix |
| `schemas/` | JSON Schema contracts for findings and reports |

## What Each File Does

### `.codex/config.toml`

Codex reads MCP server configuration from this file. It registers Inspectra as a STDIO MCP server:

```toml
[mcp_servers.inspectra]
command = "node"
args = ["/path/to/inspectra/mcp/dist/index.js"]
```

You can verify the connection in the Codex TUI with the `/mcp` command.

### `AGENTS.md`

Codex reads this file as project instructions before every task. It contains:

- Available MCP tools and their purpose (36 tools across 12 domains)
- How to run audits (full, single-domain, PR)
- Scoring model and grading scale
- Finding format specification

You can customise this file to add project-specific context. Codex concatenates `AGENTS.md` files from the project root down to the current working directory.

## Alternative Setup Methods

### Per-project symlinks (for development)

```bash
node ~/inspectra/bin/init.mjs init /my-project --codex
```

This symlinks agent/prompt files into the project (gitignored) and writes `.codex/config.toml` + `AGENTS.md`.

### Per-project copies (for CI/CD)

```bash
node ~/inspectra/bin/init.mjs init /my-project --copy --codex
```

Copies all files into the project (committed with the repo).

### Global MCP registration (alternative)

You can also register Inspectra globally so it's available in all projects:

```bash
codex mcp add inspectra -- node /path/to/inspectra/mcp/dist/index.js
```

This adds the server to `~/.codex/config.toml`. You'll still want `AGENTS.md` in each project for audit instructions.

## Running an Audit

Once set up, use Codex to audit your project:

### Full audit (CLI)

```bash
codex "Run a full Inspectra audit on this project using all domain tools."
```

### Single-domain audit

```bash
codex "Run an Inspectra security audit using inspectra_scan_secrets and inspectra_check_deps_vulns."
```

### Interactive (TUI)

```bash
codex
# Then type: Run a full Inspectra audit on this project.
# Use /mcp to verify the server connection.
```

### Non-interactive mode

```bash
codex exec "Run inspectra_scan_secrets on /path/to/project and report findings."
```

## Comparison: Copilot vs Claude Code vs Codex

| Aspect | VS Code + Copilot | Claude Code | OpenAI Codex |
| -------- | ------------------ | ------------- | -------------- |
| Setup command | `inspectra setup` | `inspectra setup --claude` | `inspectra setup --codex` |
| MCP config | `.vscode/mcp.json` | `.mcp.json` (JSON) | `.codex/config.toml` (TOML) |
| Project context | `.github/copilot-instructions.md` | `CLAUDE.md` | `AGENTS.md` |
| Agent definitions | `.github/agents/*.agent.md` | Via MCP tools | Via MCP tools |
| Entry point | Copilot Chat → `/audit` | Ask Claude | Ask Codex or `codex exec` |
| Orchestration | Agent handoffs | Claude + MCP tools | Codex + MCP tools |
| Verify MCP | MCP: List Servers | — | `/mcp` in TUI |

## Troubleshooting

### "MCP server not found" or tools not available

Ensure the MCP server is built:

```bash
cd ~/inspectra && npm run build
```

Check `.codex/config.toml` contains the correct absolute path to `mcp/dist/index.js`.

### Verify MCP connection

In the Codex TUI, type `/mcp` to see active MCP servers. You should see `inspectra` in the list.

### AGENTS.md not loaded

Codex discovers `AGENTS.md` from the project root (Git root) down to the current directory. Make sure:

- You're in the right project directory
- `AGENTS.md` is not empty
- The file hasn't exceeded `project_doc_max_bytes` (32 KiB default)

### doctor command

Run Inspectra's diagnostic tool:

```bash
node ~/inspectra/bin/init.mjs doctor
```

This checks Node.js version, MCP build, VS Code settings, agent files, policies, and schemas.
