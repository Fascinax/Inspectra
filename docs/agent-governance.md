# Agent Governance

This document describes how Inspectra enforces the [Stripe Minions principles](https://stripe.dev/blog/minions-stripes-one-shot-end-to-end-coding-agents) for reliable multi-agent operations.

## Enforcement Strategy

Inspectra uses a 3-layer enforcement model. Each layer targets a different category of principles:

```markdown
┌─────────────────────────────────────────────────────────┐
│  Layer 1: Instructions (.github/copilot-instructions.md)│  ← Always-on hard rules
├─────────────────────────────────────────────────────────┤
│  Layer 2: Skill (agent-governance)                      │  ← Behavioral guidance
├─────────────────────────────────────────────────────────┤
│  Layer 3: Agent Definitions (.github/agents/*.agent.md) │  ← Per-agent constraints
└─────────────────────────────────────────────────────────┘
```

## Layer Details

### Layer 1 — Global Instructions

**File**: `.github/copilot-instructions.md`

Contains the "Agent Governance" section with:

- **Hard Blocks** — Actions agents must NEVER perform (git push, modify governance files, install deps)
- **Agent Scope** — Explicit IN/OUT scope table for each domain agent
- **Task Decomposition** — One agent, one domain, one report
- **The Pit of Success** — Quality in = quality out
- **Traceability** — Metadata requirements for every report and commit
- **Standardization** — Consistent agent prompt structure
- **Per-Agent Isolation** — No shared state between agents

**Why here**: These rules apply to EVERY interaction, not just specific workflows. Instructions are always loaded by Copilot.

### Layer 2 — Agent Governance Skill

**File**: `~/.copilot/skills/agent-governance/SKILL.md`

Contains detailed behavioral guidance for:

- **Rule #1: Never Fix Bad Output** — Diagnose → Reset → Fix → Re-run workflow
- **Task Decomposition** — Multi-agent swarm pattern (coordinator → lead → scout → build → review)
- **Specs: No Ambiguity** — Detailed spec template with input/output/scope/success criteria
- **Quality Gates** — 7-point checklist for validating agent output
- **Anti-Patterns** — Common mistakes and their corrections

**Why a skill**: Skills are triggered contextually — this fires when working with multi-agent coordination, but doesn't pollute simple code editing sessions with irrelevant agent rules.

### Layer 3 — Enriched Agent Definitions

**Files**: `.github/agents/*.agent.md`

Each agent now has three new sections:

#### Scope Boundaries

- Explicit IN-scope and OUT-of-scope file patterns per agent
- "If you encounter something outside your scope, ignore it — do NOT report it"

#### Hard Blocks

- Agent-specific prohibitions (e.g., audit-tests: "NEVER execute tests")
- Generic prohibitions (no git push, no governance file modifications)

#### Quality Checklist

- Pre-return verification checklist specific to each agent
- Finding ID pattern, evidence, confidence bounds, metadata completeness
- "If any check fails, fix the root cause and regenerate — do NOT patch the output"

**Why in agents**: Scope and quality constraints are agent-specific. The security agent has different boundaries than the conventions agent.

## MCP Governance Tools

Inspectra provides two MCP tools for agent traceability:

- **`inspectra_log_activity`** — Records agent actions to a JSONL log (`.inspectra/activity.jsonl`). Every domain agent should log its start/end and key decisions.
- **`inspectra_read_activity_log`** — Reads and filters activity log entries. The orchestrator uses this to verify which agents ran and what they did.

These tools enforce the **Traceability** principle: every agent action must be auditable after the fact.

## Principle Coverage Matrix

| Stripe Minions Principle | Layer 1 (Instructions) | Layer 2 (Skill) | Layer 3 (Agents) | MCP Tools |
| --- | :---: | :---: | :---: | :---: |
| Rule #1: Never Fix Bad Output | ✓ | ✓✓ | ✓ | |
| Hard Blocks | ✓✓ | ✓ | ✓ | |
| Agent Scope | ✓✓ | ✓ | ✓✓ | |
| Task Decomposition | ✓ | ✓✓ | ✓ | |
| The Pit of Success | ✓✓ | ✓ | | |
| Traceability | ✓✓ | ✓ | ✓ | ✓✓ (activity log) |
| Standardization | ✓✓ | | ✓✓ | |
| Per-Agent Isolation | ✓✓ | ✓ | ✓ | |
| Quality Gates | | ✓✓ | ✓ | |
| Specs / No Ambiguity | | ✓✓ | | |

✓✓ = primary enforcement layer, ✓ = reinforcing layer

## Prompts

### agent-task-spec

**File**: `.github/prompts/agent-task-spec.prompt.md`

A reusable prompt for writing unambiguous agent task specifications. Follows the "Specs should leave NO ambiguity" principle with a structured template: Task → Input → Output → Scope → Success Criteria → Failure Protocol.

## Adding New Principles

When adding a new governance principle:

1. Determine which layer it belongs to using this heuristic:
   - **Always on, never negotiable** → Layer 1 (Instructions)
   - **Behavioral, contextual, detailed** → Layer 2 (Skill)
   - **Agent-specific constraint** → Layer 3 (Agent definition)
   - **Runtime traceability** → MCP Tool
2. Add the principle to the appropriate files
3. Update this document's coverage matrix
4. Test that the principle is actually enforced (don't trust, verify)
