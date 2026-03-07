# ADR-002: YAML-first policy model

## Status

Accepted

## Context

Inspectra needs configurable scoring weights, severity thresholds, and stack-specific rule overrides. These values change over time (new domains, recalibrated weights) and must be auditable. Hard-coding them in TypeScript or JSON would require code changes and redeployment for each policy update.

## Decision

All policy configuration (scoring weights, severity penalties, profile overrides) is stored in YAML files under `policies/`. The MCP server reads these files at startup using a typed `loadPolicy` utility in `mcp/src/policies/loader.ts`. TypeScript code never hardcodes scoring values—it always reads from the loaded policy object.

Three primary files govern behaviour:
- `policies/scoring-rules.yml` — domain weights and grade thresholds
- `policies/severity-matrix.yml` — per-severity score penalties
- `policies/profiles/` — stack-specific overrides (e.g., `java-angular-playwright.yml`)

## Consequences

- Policy changes require no TypeScript recompilation; edit the YAML and restart.
- Teams can fork Inspectra and provide custom profiles without touching source code.
- All scoring logic is auditable via diff on plain-text YAML.
- The loader must validate YAML structure at startup and fail fast on schema violations.
- Adding a new domain requires adding its weight to `scoring-rules.yml` in addition to the agent and tools.
