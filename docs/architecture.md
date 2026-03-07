# Inspectra Architecture

## System Overview

Inspectra is a multi-agent code audit system built on GitHub Copilot Custom Agents and the Model Context Protocol (MCP).

```
┌─────────────────────────────────────────────────────────┐
│                     User / CI                           │
│            (prompt or issue assignment)                  │
└──────────────────────┬──────────────────────────────────┘
                       │
                       ▼
┌─────────────────────────────────────────────────────────┐
│               Audit Orchestrator Agent                  │
│          (.github/agents/audit-orchestrator)             │
│                                                         │
│  ┌───────────┐ ┌───────────┐ ┌───────────┐ ┌─────────┐ │
│  │ Security  │ │   Tests   │ │   Archi   │ │  Conv   │ │
│  │   Agent   │ │   Agent   │ │   Agent   │ │  Agent  │ │
│  └─────┬─────┘ └─────┬─────┘ └─────┬─────┘ └────┬────┘ │
└────────┼──────────────┼─────────────┼────────────┼──────┘
         │              │             │            │
         ▼              ▼             ▼            ▼
┌─────────────────────────────────────────────────────────┐
│                  MCP Server (inspectra)                  │
│                                                         │
│  ┌─────────────┐ ┌────────────┐ ┌──────────────────┐   │
│  │  Security   │ │   Tests    │ │  Architecture    │   │
│  │  Tools      │ │   Tools    │ │  Tools           │   │
│  │             │ │            │ │                  │   │
│  │ inspectra_scan_secrets│ │parse-cover │ │ inspectra_check_layering  │   │
│  │ check-deps  │ │parse-tests │ │ analyze-deps    │   │
│  └─────────────┘ │detect-miss │ └──────────────────┘   │
│                   └────────────┘                        │
│  ┌─────────────┐ ┌────────────────────┐                │
│  │ Code Quality│ │     Merger         │                │
│  │             │ │                    │                │
│  │ check-name  │ │ merge-domain-rpts  │                │
│  │ check-length│ │ inspectra_score_findings     │                │
│  │ inspectra_check_todos │ │ deduplicate        │                │
│  └─────────────┘ └────────────────────┘                │
└─────────────────────────────────────────────────────────┘
         │
         ▼
┌─────────────────────────────────────────────────────────┐
│           Schemas (finding, domain-report,               │
│               consolidated-report)                       │
│                                                         │
│           Policies (severity-matrix,                     │
│              scoring-rules, profiles)                    │
└─────────────────────────────────────────────────────────┘
```

## Data Flow

1. User triggers an audit via a prompt file or issue assignment.
2. The orchestrator agent receives the request and determines scope.
3. The orchestrator delegates to domain-specific agents.
4. Each domain agent calls MCP tools to gather data.
5. Each domain agent returns a **domain report** (JSON conforming to `domain-report.schema.json`).
6. The orchestrator calls `inspectra_merge_domain_reports` to combine results.
7. The orchestrator produces the final **consolidated report** in Markdown.

## Key Design Decisions

### Agents Don't Contain Business Logic

Agents are prompt-driven coordinators. The actual analysis logic lives in MCP tools (TypeScript). This separation means:

- Tools can be tested independently.
- Tools can be reused across agents.
- Agent prompts can evolve without breaking analysis logic.

### Schema-First Contract

All inter-agent communication uses JSON validated against `schemas/`. This prevents format drift and enables automated validation.

### Weighted Scoring Model

Domain scores are weighted to reflect risk priority (weights from `policies/scoring-rules.yml`):

**Core domains:**

- Security: 24%
- Tests: 20%
- Architecture: 16%
- Conventions: 12%
- Performance: 10%
- Documentation: 8%
- Tech-debt: 10%

**Extended domains (v0.7+):**

- Accessibility: 8%
- API-design: 7%
- Observability: 6%
- i18n: 5%

**Extended domains (v0.8+):**

- UX-consistency: 6%

Weights are re-normalized at runtime based on which domains were actually audited.

### Stack-Specific Profiles

Policies can be tailored per technology stack. The `java-angular-playwright` profile defines thresholds and conventions specific to that combination.

### Response Size Budget

Every MCP tool response is bounded by `CHARACTER_LIMIT` (default: 10,000 chars, env: `INSPECTRA_CHARACTER_LIMIT`). When a tool produces more findings than fit in that budget, `findingsResponse` automatically truncates the array and adds a `truncated: true` flag with total count. This keeps responses inline in the VS Code Copilot MCP panel — responses that exceed the panel's threshold (~8KB) are stored to disk and become inaccessible to the orchestrator.

To retrieve all findings when truncation occurs, use the `offset` pagination parameter:

```json
{ "projectDir": "...", "limit": 20, "offset": 20 }
```

---

## Troubleshooting

### Subagent Tools Show as "Disabled"

**Symptom:** Domain agents invoked via orchestrator handoff report that `inspectra_*` tools are "disabled by user" or "not available", even though the MCP server is running.

**Root cause:** VS Code Copilot's MCP tool toggle panel is per-session and applies independently to subagents. When the orchestrator delegates to a domain agent, that subagent inherits its own tool availability state, which may differ from the orchestrator's session.

**Fix:**

1. Open VS Code → Command Palette → "MCP: List Servers" → verify `inspectra` shows ✅
2. In the Copilot chat panel, click the tool icon (🔧) to open the tool selector
3. Ensure **all** `inspectra_*` tools are checked — any unchecked tool will be unavailable to all agents (including subagents)
4. If a tool was unchecked due to a previous error, re-check it and retry the audit

**Fallback:** The orchestrator can call `inspectra_*` tools directly (without delegating to a subagent). If a domain agent consistently fails, the orchestrator can perform Phase 1 tool scanning itself and skip Phase 2 LLM exploration for that domain.

### Tool Responses Stored to Disk (workspaceStorage)

**Symptom:** A tool call succeeds but the orchestrator cannot access the response — it was stored to a `workspaceStorage` or `toolu_*` path.

**Root cause:** The tool response exceeded VS Code's inline response threshold (~8KB). The response was cached to disk rather than returned inline.

**Fix:** Use pagination to reduce response size:

- Add `"limit": 10` to reduce the finding count
- Use `"offset": N` to page through results
- Or raise the budget: set `INSPECTRA_CHARACTER_LIMIT=30000` in the MCP server environment

The `CHARACTER_LIMIT` constant (default 10,000) is calibrated to keep responses below the threshold. If you routinely scan very large codebases, raise it via the env var.
