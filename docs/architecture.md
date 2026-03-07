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
