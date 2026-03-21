# Workflow Governance

This document describes how Inspectra applies the [Stripe Minions principles](https://stripe.dev/blog/minions-stripes-one-shot-end-to-end-coding-agents) to prompt-driven audit workflows and contributor automation.

## Enforcement Strategy

Inspectra uses a 2-layer enforcement model plus audit logging. Each layer targets a different category of principles:

```markdown
┌─────────────────────────────────────────────────────────┐
│  Layer 1: Instructions (.github/copilot-instructions.md)│  ← Always-on hard rules
├─────────────────────────────────────────────────────────┤
│  Layer 2: Skill (agent-governance)                      │  ← Behavioral guidance
├─────────────────────────────────────────────────────────┤
│  Runtime: MCP activity log                              │  ← Traceability
└─────────────────────────────────────────────────────────┘
```

## Layer Details

### Layer 1 — Global Instructions

**File**: `.github/copilot-instructions.md`

Contains the governance section with:

- **Hard Blocks** — Actions agents must NEVER perform (git push, modify governance files, install deps)
- **Domain Scope** — Explicit IN/OUT scope for each audit domain
- **Task Decomposition** — One workflow step, one concern, one report
- **The Pit of Success** — Quality in = quality out
- **Traceability** — Metadata requirements for every report and commit
- **Standardization** — Consistent agent prompt structure
- **Per-Agent Isolation** — No shared state between agents

**Why here**: These rules apply to EVERY interaction, not just specific workflows. Instructions are always loaded by Copilot.

### Layer 2 — Agent Governance Skill

**File**: `~/.copilot/skills/agent-governance/SKILL.md`

Contains detailed behavioral guidance for:

- **Rule #1: Never Fix Bad Output** — Diagnose → Reset → Fix → Re-run workflow
- **Task Decomposition** — Focused workflow decomposition with strict scope and handoff boundaries
- **Specs: No Ambiguity** — Detailed spec template with input/output/scope/success criteria
- **Quality Gates** — 7-point checklist for validating agent output
- **Anti-Patterns** — Common mistakes and their corrections

**Why a skill**: Skills are triggered contextually — this fires for workflow orchestration and structured handoffs without polluting simple code editing sessions.

## MCP Governance Tools

Inspectra provides two MCP tools for agent traceability:

- **`inspectra_log_activity`** — Records workflow activity to a JSONL log (`.inspectra/activity.jsonl`). Audit runs and contributor automation should log start/end and key decisions.
- **`inspectra_read_activity_log`** — Reads and filters activity log entries for traceability.

These tools enforce the **Traceability** principle: every workflow action must be auditable after the fact.

## Principle Coverage Matrix

| Stripe Minions Principle | Layer 1 (Instructions) | Layer 2 (Skill) | MCP Tools |
| --- | :---: | :---: | :---: |
| Rule #1: Never Fix Bad Output | ✓ | ✓✓ | |
| Hard Blocks | ✓✓ | ✓ | |
| Domain Scope | ✓✓ | ✓ | |
| Task Decomposition | ✓ | ✓✓ | |
| The Pit of Success | ✓✓ | ✓ | |
| Traceability | ✓✓ | ✓ | ✓✓ |
| Standardization | ✓✓ | | |
| Quality Gates | | ✓✓ | |
| Specs / No Ambiguity | | ✓✓ | |

✓✓ = primary enforcement layer, ✓ = reinforcing layer

## Prompt Structure

Inspectra governance now centers on the three active audit prompts:

- `.github/prompts/audit.prompt.md`
- `.github/prompts/audit-pr.prompt.md`
- `.github/prompts/audit-domain.prompt.md`

All three follow the same governance principles: explicit scope, deterministic tool-first workflow, pagination discipline, and clear failure behavior.

## Adding New Principles

When adding a new governance principle:

1. Determine which layer it belongs to using this heuristic:
   - **Always on, never negotiable** → Layer 1 (Instructions)
   - **Behavioral, contextual, detailed** → Layer 2 (Skill)
   - **Runtime traceability** → MCP Tool
2. Add the principle to the appropriate files
3. Update this document's coverage matrix
4. Test that the principle is actually enforced (don't trust, verify)
