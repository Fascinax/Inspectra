# Adding an Agent

This guide explains how to add a new audit domain agent to Inspectra.

## Overview

An Inspectra agent is a Copilot Custom Agent defined as a Markdown file with YAML frontmatter. Each agent audits a specific domain and returns structured findings.

## Steps

### 1. Define the Domain

Choose a domain name (e.g., `performance`, `documentation`) and a finding prefix (e.g., `PRF-`, `DOC-`).

Make sure the domain is listed in `mcp/src/types.ts` in the `DOMAINS` array. If not, add it:

```typescript
export const DOMAINS = ["security", "tests", "architecture", "conventions", "performance", "documentation"] as const;
```

### 2. Create the Agent File

Create `.github/agents/audit-<domain>.agent.md` with this structure:

```markdown
---
name: audit-<domain>
description: <Domain> audit agent. <What it does>. Produces a domain report.
tools:
  - read
  - search
  - inspectra/<tool-1>
  - inspectra/<tool-2>
---

You are **Inspectra <Domain> Agent**, a specialized <domain> auditor.

## Your Mission

<What the agent evaluates>

## What You Audit

1. **Category 1**: Description
2. **Category 2**: Description

## Workflow

1. Use `<tool-1>` to ...
2. Use `<tool-2>` to ...
3. Use `read` and `search` to manually inspect ...
4. Combine all findings into a single domain report.

## Output Format

Return a **single JSON object** following this structure:

\```json
{
  "domain": "<domain>",
  "score": <0-100>,
  "summary": "<one-line summary>",
  "findings": [...],
  "metadata": {
    "agent": "audit-<domain>",
    "timestamp": "<ISO 8601>",
    "tools_used": ["<tool-1>", "<tool-2>"]
  }
}
\```

## Rules
- Every finding MUST include id, severity, title, domain, rule, confidence.
- Use the `<PREFIX>-XXX` format for finding IDs.
- Set confidence between 0.0 and 1.0.
- Include at least one evidence entry with a file path.
```

### 3. Implement MCP Tools

Add tool functions in `mcp/src/tools/<domain>.ts`. See [adding-a-tool.md](adding-a-tool.md) for details.

### 4. Register in the Orchestrator

Add a handoff to `.github/agents/audit-orchestrator.agent.md`:

```yaml
handoffs:
  # ... existing handoffs ...
  - label: <Domain> Audit
    agent: audit-<domain>
    prompt: Run a <domain> audit on the target project and return a domain report JSON.
```

### 5. Update Scoring Weights

Add the domain weight in `policies/scoring-rules.yml`:

```yaml
domain_weights:
  security: 0.30
  tests: 0.25
  architecture: 0.20
  conventions: 0.15
  performance: 0.05    # ← adjust as needed
  documentation: 0.05
```

Ensure all weights sum to approximately 1.0.

### 6. Update copilot-instructions.md

Add the new tools to the MCP tools table in `.github/copilot-instructions.md`.

### 7. Test

1. Build: `npm run build`
2. Run the agent in Copilot Chat against a test project.
3. Verify the domain report JSON is valid against `schemas/domain-report.schema.json`.
4. Run a full audit and confirm the new domain appears in the consolidated report.

## Conventions

- Agent file: `audit-<domain>.agent.md`
- Finding prefix: uppercase abbreviation, 2-3 chars (e.g., `PRF`, `DOC`)
- ID range: use non-overlapping counter ranges across tools within the domain
- All agents return JSON, never free-form text
- Set appropriate confidence levels — don't default everything to 1.0
