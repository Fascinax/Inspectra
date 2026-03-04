# ADR-001: Multi-agent architecture for code audits

## Status

Accepted

## Context

Inspectra needs to audit codebases across multiple quality domains (security, tests, architecture, conventions, performance, documentation, tech debt). A single monolithic agent would be hard to maintain and produce lower-quality results.

## Decision

Use a multi-agent architecture where each domain has a dedicated agent coordinated by an orchestrator. Agents communicate through structured JSON reports conforming to `schemas/domain-report.schema.json`.

## Consequences

- Each agent can be developed, tested, and improved independently.
- The orchestrator handles merging, deduplication, and scoring.
- Agents operate in isolation with no shared mutable state.
- Adding a new domain requires creating one agent + its MCP tools without modifying existing agents.
