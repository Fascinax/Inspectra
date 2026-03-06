# Output Format

This document describes the JSON structures produced by Inspectra at each stage of an audit.

## Finding

The atomic unit of audit output. Every issue detected by any tool or agent is expressed as a finding.

**Schema:** `schemas/finding.schema.json`

```json
{
  "id": "SEC-001",
  "severity": "high",
  "title": "Potential hardcoded secret",
  "description": "A pattern matching 'no-hardcoded-secret' was found.",
  "domain": "security",
  "rule": "no-hardcoded-secret",
  "confidence": 0.85,
  "evidence": [
    { "file": "src/config/auth.ts", "line": 14, "snippet": "const API_KEY = \"sk-abc123...\"" }
  ],
  "recommendation": "Move this value to an environment variable or a secrets manager.",
  "effort": "small",
  "tags": ["secret", "credentials"]
}
```

### Required Fields

| Field | Type | Description |
| ------- | ------ | ------------- |
| `id` | string | `DOMAIN_PREFIX-XXX` (e.g., `SEC-001`, `TST-042`) |
| `severity` | enum | `critical`, `high`, `medium`, `low`, `info` |
| `title` | string | Concise description (max 200 chars) |
| `domain` | enum | `security`, `tests`, `architecture`, `conventions`, `performance`, `documentation` |
| `rule` | string | Machine-readable rule identifier |
| `confidence` | float | 0.0 (guess) to 1.0 (certain) |
| `evidence` | array | At least one file path with optional line and snippet |

### Optional Fields

| Field | Type | Description |
| ------- | ------ | ------------- |
| `description` | string | Detailed explanation (max 2000 chars) |
| `recommendation` | string | Actionable fix suggestion |
| `effort` | enum | `trivial`, `small`, `medium`, `large`, `epic` |
| `tags` | array | Free-form labels for filtering |

## Domain Report

Produced by each domain agent after completing its audit.

**Schema:** `schemas/domain-report.schema.json`

```json
{
  "domain": "security",
  "score": 72,
  "summary": "1 high, 2 medium",
  "findings": [ /* Finding[] */ ],
  "metadata": {
    "agent": "audit-security",
    "timestamp": "2026-01-15T10:00:00.000Z",
    "duration_ms": 1200,
    "tools_used": ["inspectra_scan_secrets", "inspectra_check_deps_vulns"]
  }
}
```

## Consolidated Report

The final merged report produced by the orchestrator.

**Schema:** `schemas/consolidated-report.schema.json`

```json
{
  "overall_score": 78,
  "grade": "B",
  "summary": "Overall score: 78/100 (Grade B). Findings: 1 high, 4 medium, 3 low.",
  "domain_reports": [ /* DomainReport[] */ ],
  "top_findings": [ /* Finding[] — top 10 by severity+confidence */ ],
  "statistics": {
    "total_findings": 8,
    "by_severity": { "critical": 0, "high": 1, "medium": 4, "low": 3, "info": 0 },
    "by_domain": { "security": 3, "tests": 2, "architecture": 2, "conventions": 1 }
  },
  "metadata": {
    "timestamp": "2026-01-15T10:05:00.000Z",
    "target": "/path/to/project",
    "profile": "java-angular-playwright",
    "duration_ms": 4500,
    "agents_invoked": ["audit-security", "audit-tests", "audit-architecture", "audit-conventions"]
  }
}
```

## Rendered Formats

The report engine can output the consolidated report in multiple formats:

| Format | Command Flag | Description |
| -------- | ------------- | ------------- |
| **Markdown** | `--format=markdown` | Human-readable report with tables, icons, and sections |
| **JSON** | `--format=json` | Raw consolidated report JSON |
| **SARIF** | `--format=sarif` | Static Analysis Results Interchange Format for CI integration |

### SARIF

The SARIF output conforms to [SARIF v2.1.0](https://sarifweb.azurewebsites.net/) and can be uploaded to GitHub Code Scanning or any SARIF-compatible tool. Each finding maps to:

- `result.ruleId` → `finding.id`
- `result.level` → mapped from `finding.severity`
- `result.message` → `finding.title` + `finding.description`
- `result.locations` → `finding.evidence`
- `result.properties.rule` → `finding.rule`
