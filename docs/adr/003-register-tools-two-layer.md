# ADR-003: Register/tools two-layer separation

## Status

Accepted

## Context

Each MCP tool requires two concerns to be addressed: (1) the business logic that scans code and produces `Finding[]`, and (2) the MCP protocol layer that validates inputs, calls the logic, and serialises the response. Mixing these concerns in one file makes both harder to unit test: business logic tests don't need MCP infrastructure, and protocol tests shouldn't re-execute the scan.

## Decision

Implement every tool as two separate files:

- `mcp/src/tools/<domain>.ts` — pure TypeScript functions that take a `projectDir` string (and optionally a `ProfileConfig`) and return `Promise<Finding[]>`. No MCP SDK imports.
- `mcp/src/register/<domain>.ts` — imports from the corresponding tool file, wraps the call in `server.setRequestHandler`, validates inputs with Zod, and serialises using `findingsResponse()` or `jsonResponse()` from `register/response.ts`.

The MCP server entry point (`src/index.ts`) calls only the `register/` functions.

## Consequences

- Tool functions are pure and can be unit-tested with real temp directories, no mocking required.
- The register layer can be replaced (e.g., REST adapter, CLI wrapper) without touching business logic.
- Adding a tool requires creating one file in `tools/` and one in `register/`—a predictable, low-friction pattern.
- The convention must be enforced via code review; there is no automated linting rule preventing cross-layer imports today.
