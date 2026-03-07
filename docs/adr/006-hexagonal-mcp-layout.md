# ADR-006: Hexagonal MCP layout

## Status

Accepted

## Context

The MCP server must remain testable, extensible, and transport-agnostic. Bundling domain logic directly with the MCP SDK transport layer (stdio) would make it impossible to add REST or WebSocket adapters later without reimplementing the core logic. It would also force integration tests to spin up an MCP process rather than calling functions directly.

## Decision

The server follows a Hexagonal Architecture (Ports and Adapters) where the MCP transport is one adapter, not the core:

```
┌─────────────────────────────────────────────┐
│                   Adapters                  │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐  │
│  │  stdio   │  │   REST   │  │   CLI    │  │
│  │ (MCP SDK)│  │ (future) │  │  (bin/)  │  │
│  └────┬─────┘  └────┬─────┘  └────┬─────┘  │
│       └─────────────┴─────────────┘        │
│                     │                       │
│              ┌──────▼──────┐                │
│              │  register/  │  (Ports)       │
│              │  (Zod I/O)  │                │
│              └──────┬──────┘                │
│                     │                       │
│              ┌──────▼──────┐                │
│              │   tools/    │  (Core)        │
│              │  (pure fns) │                │
│              └──────┬──────┘                │
│                     │                       │
│         ┌───────────┼───────────┐           │
│    ┌────▼────┐ ┌────▼────┐ ┌───▼────┐      │
│    │policies/│ │ utils/  │ │merger/ │      │
│    │(YAML)   │ │(files)  │ │(score) │      │
│    └─────────┘ └─────────┘ └────────┘      │
└─────────────────────────────────────────────┘
```

- **Core** (`tools/`): pure async functions, no MCP imports, fully unit-testable.
- **Ports** (`register/`): Zod input validation + MCP response serialisation.
- **Adapters** (`index.ts` + `bin/`): MCP stdio transport and CLI entry point.

## Consequences

- Adding a REST adapter means implementing `register/http-adapter.ts` without touching `tools/`.
- Unit tests call `tools/` functions directly with real temp directories—no MCP server required.
- The architecture introduces an indirection layer (register/) that must be maintained alongside tools.
- New tool authors must understand the boundary: anything that imports `@modelcontextprotocol/sdk` belongs in `register/` or `index.ts`, never in `tools/`.
