# Claude Code Setup

This guide explains how to use Inspectra with [Claude Code](https://docs.anthropic.com/en/docs/claude-code) — Anthropic's agentic coding tool.

## Prerequisites

- **Node.js 20+** — [nodejs.org](https://nodejs.org)
- **Claude Code** — installed via `npm install -g @anthropic-ai/claude-code` or used through VS Code's Claude extension
- **Inspectra** — cloned and built

## Quick Start

```bash
# 1. Clone and build Inspectra
git clone <repo-url> ~/inspectra
cd ~/inspectra
npm install && npm run build

# 2. Set up your project for Claude Code
cd /path/to/my-project
node ~/inspectra/bin/init.mjs setup --claude
```

This creates two files in your project:

| File | Purpose |
|------|---------|
| `.mcp.json` | Claude Code MCP server auto-configuration |
| `CLAUDE.md` | Project context with audit instructions |

## What Each File Does

### `.mcp.json`

Claude Code reads this file at startup and automatically connects to the Inspectra MCP server:

```json
{
  "mcpServers": {
    "inspectra": {
      "command": "node",
      "args": ["/path/to/inspectra/mcp/dist/index.js"]
    }
  }
}
```

Claude Code will start the MCP server as a subprocess and expose all 35 Inspectra tools.

### `CLAUDE.md`

Claude Code reads this as project context. It contains:
- Available MCP tools and their purpose
- How to run audits (full, single-domain, PR)
- Scoring model and grading scale
- Finding format specification

You can customise this file to add project-specific context.

## Alternative Setup Methods

### Per-project symlinks (for development)

```bash
node ~/inspectra/bin/init.mjs init /my-project --claude
```

This symlinks agent/prompt files into the project (gitignored) and writes `.mcp.json` + `CLAUDE.md`.

### Per-project copies (for CI/CD)

```bash
node ~/inspectra/bin/init.mjs init /my-project --copy --claude
```

Copies all files into the project (committed with the repo).

## Running an Audit

Once set up, open your project with Claude Code and ask:

```
Run a full Inspectra audit on this project.
```

Claude Code will:
1. Read `CLAUDE.md` for context
2. Connect to the Inspectra MCP server via `.mcp.json`
3. Call domain tools (`inspectra_scan_secrets`, `inspectra_check_deps_vulns`, etc.)
4. Merge results with `inspectra_merge_domain_reports`
5. Generate a scored report

### Single-Domain Audit

```
Run an Inspectra security audit on this project.
```

### PR-Scoped Audit

```
Audit only the files changed in this PR using Inspectra.
```

## Comparison: Copilot vs Claude Code

| Aspect | VS Code + Copilot | Claude Code |
|--------|------------------|-------------|
| Setup command | `inspectra setup` | `inspectra setup --claude` |
| MCP config | `.vscode/mcp.json` (`servers` format) | `.mcp.json` (`mcpServers` format) |
| Project context | `.github/copilot-instructions.md` | `CLAUDE.md` |
| Agent definitions | `.github/agents/*.agent.md` | Embedded in `CLAUDE.md` (via MCP tools) |
| Entry point | Copilot Chat → select agent → `/audit` | Ask Claude to run an audit |
| Orchestration | Copilot agent handoffs | Claude reads instructions + calls MCP tools |

## Troubleshooting

### "MCP server not found"

Ensure the MCP server is built:

```bash
cd ~/inspectra && npm run build
```

Check that `mcp/dist/index.js` exists.

### "Tools not available"

Verify `.mcp.json` in your project root is valid JSON and the path to `index.js` is absolute.

### doctor command

Run the diagnostic tool:

```bash
node ~/inspectra/bin/init.mjs doctor
```

This checks Node.js version, MCP build, VS Code settings, agent files, policies, and schemas.

## Generating CLAUDE.md via MCP Tool

If you want to generate a more detailed `CLAUDE.md` that includes full agent definitions, use the MCP tool directly:

```
Call inspectra_generate_claude_md with projectDir set to the Inspectra root and write: true.
```

This reads all `.agent.md` files and compiles them into a comprehensive reference document.
