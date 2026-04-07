# Inspectra Architecture

## System Overview

Inspectra is a hybrid code audit system built on GitHub Copilot prompt workflows and the Model Context Protocol (MCP). Two audit architectures are available:

- **Tier B (Hybrid)**: Single-prompt workflow. Default, proven by benchmark.
- **Map-Reduce (Multi-Agent)**: Orchestrator + 12 parallel domain agents. Deeper per-domain analysis.

### Tier B (Default)

```
┌─────────────────────────────────────────────────────────┐
│                     User / CI                           │
│            (prompt or issue assignment)                  │
└──────────────────────┬──────────────────────────────────┘
                       │
                       ▼
┌─────────────────────────────────────────────────────────┐
│              Prompt Workflow (Tier B Hybrid)            │
│                                                         │
│  1. Run MCP tools                                       │
│  2. Detect hotspots                                     │
│  3. Explore hotspot files conditionally                 │
│  4. Score, merge, and render                            │
└──────────────────────────────┬──────────────────────────┘
                               │
                               ▼
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

### Tier B (Default)

1. User triggers an audit via a prompt file or issue assignment.
2. The prompt workflow determines scope and runs the relevant MCP tools.
3. Tool findings are grouped into domains and analyzed for hotspots.
4. Hotspot files may receive a focused explorer pass.
5. The workflow calls `inspectra_score_findings` and `inspectra_merge_domain_reports`.
6. The final **consolidated report** is produced in Markdown, HTML, PDF, JSON, or SARIF.

### Map-Reduce (Multi-Agent)

1. User triggers an audit via `@audit-orchestrator`.
2. The orchestrator runs ALL MCP tools centrally and collects findings.
3. Hotspot detection identifies files with clustered findings across multiple domains.
4. The orchestrator dispatches to 12 specialized domain agents in parallel, passing each agent its domain findings + hotspot files.
5. Each domain agent synthesizes findings and explores hotspot files through its domain lens, returning a domain report.
6. The orchestrator performs cross-domain correlation, root cause inference, and remediation planning.
7. The final consolidated report is produced with per-agent attribution.

## Key Design Decisions

### Prompts Don't Contain Business Logic

Prompt workflows coordinate the audit. The actual analysis logic lives in MCP tools (TypeScript). This separation means:

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

### Troubleshooting

### MCP Tools Show as "Disabled"

**Symptom:** The prompt workflow cannot call `inspectra_*` tools even though the MCP server is running.

**Root cause:** VS Code Copilot's MCP tool toggle panel is per-session. If a tool is unchecked, the prompt workflow cannot use it.

**Fix:**

1. Open VS Code → Command Palette → "MCP: List Servers" → verify `inspectra` shows ✅
2. In the Copilot chat panel, click the tool icon (🔧) to open the tool selector
3. Ensure **all** `inspectra_*` tools are checked
4. If a tool was unchecked due to a previous error, re-check it and retry the audit

### Tool Responses Stored to Disk (workspaceStorage)

**Symptom:** A tool call succeeds but the orchestrator cannot access the response — it was stored to a `workspaceStorage` or `toolu_*` path.

**Root cause:** The tool response exceeded VS Code's inline response threshold (~8KB). The response was cached to disk rather than returned inline.

**Fix:** Use pagination to reduce response size:

- Add `"limit": 10` to reduce the finding count
- Use `"offset": N` to page through results
- Or raise the budget: set `INSPECTRA_CHARACTER_LIMIT=30000` in the MCP server environment

The `CHARACTER_LIMIT` constant (default 10,000) is calibrated to keep responses below the threshold. If you routinely scan very large codebases, raise it via the env var.
