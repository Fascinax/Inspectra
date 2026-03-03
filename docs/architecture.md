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

Domain scores are weighted to reflect risk priority:
- Security: 30% (highest weight — vulnerabilities have the most impact)
- Tests: 25% (test quality is a strong predictor of reliability)
- Architecture: 20% (structural issues compound over time)
- Conventions: 15% (consistency aids maintainability)
- Other: 10% (reserved for future domains)

### Stack-Specific Profiles

Policies can be tailored per technology stack. The `java-angular-playwright` profile defines thresholds and conventions specific to that combination.
