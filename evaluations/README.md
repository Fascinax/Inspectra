# ADR-008 Benchmark Suite

Empirical evaluation of three audit architectures, as defined in [ADR-008](../docs/adr/008-benchmark-before-architecture.md).

## Tiers

| Tier | Architecture | Prompt |
|------|-------------|--------|
| **A** | Single-pass: all MCP tools → 1 LLM synthesis | `.github/prompts/audit-tier-a.prompt.md` |
| **B** | Hybrid: all tools + conditional explorer on hotspot files | `.github/prompts/audit-tier-b.prompt.md` |
| **C** | Current: 12 domain agents with Phase 1 + Phase 2 | `.github/prompts/audit.prompt.md` |

## Fixtures

| Fixture | Stack | Seeded Issues | Ground Truth |
|---------|-------|--------------|--------------|
| `bench-ts-express` | TypeScript/Express | 21 | `ground-truth/bench-ts-express.json` |
| `bench-java-spring` | Java/Spring Boot | 20 | `ground-truth/bench-java-spring.json` |
| `bench-angular-app` | Angular 18 | 19 | `ground-truth/bench-angular-app.json` |
| `bench-messy-fullstack` | TS/Express (messy) | 39 | `ground-truth/bench-messy-fullstack.json` |

Each fixture is a self-contained project under `fixtures/` with intentionally seeded issues. The ground truth JSON documents every issue with its file, line, severity, domain, expected tool, and root cause chain.

## Metrics

| Metric | Definition | Target |
|--------|-----------|--------|
| Precision | TP / (TP + FP) — fraction of reported findings that are real | ≥ 0.6 |
| Recall | TP / ground truth — fraction of real issues detected | ≥ 0.5 |
| Tool Recall | Recall limited to tool-detectable issues | — |
| LLM-Only Recall | Recall limited to issues only an LLM can find | — |
| RC Hit Rate | Fraction of root causes identified (explicit or ≥2 symptoms) | — |
| Actionability | Severity-weighted score of detected issues (0-10) | ≥ 3.0 |
| Dedup Effectiveness | 1 − (duplicate ratio) among reported findings | — |
| Diagnostic Value | (precision × recall × actionability) / (token_cost × variance) | Higher is better |

## Running the Benchmark

### Step 1: Run a Tier Prompt

Open a Copilot chat and run one of the tier prompts against a fixture repo. For example, for Tier A on bench-ts-express:

```
@workspace /audit-tier-a

Target: evaluations/fixtures/bench-ts-express
```

### Step 2: Save the Audit Output

Copy the JSON findings output into a file with this shape:

```json
{
  "tier": "A",
  "fixture": "bench-ts-express",
  "findings": [
    {
      "id": "SEC-001",
      "severity": "critical",
      "title": "Hardcoded JWT secret",
      "domain": "security",
      "rule": "no-hardcoded-secret",
      "confidence": 0.95,
      "evidence": [{ "file": "src/config.ts", "line": 4 }],
      "source": "tool"
    }
  ],
  "root_causes_reported": [
    { "id": "RC-001", "title": "No secret management strategy", "symptoms": ["SEC-001", "SEC-002"] }
  ],
  "token_count": 12000,
  "latency_ms": 45000
}
```

```bash
npx tsx evaluations/benchmark-runner.ts --evaluate --audit-file runs/tier-a-express-run1.json
```

This computes all metrics and writes:
- `evaluations/results/A-bench-ts-express-<timestamp>.json` — full metrics
- `evaluations/results/A-bench-ts-express-<timestamp>-missed.md` — missed issues report

### Step 4: Repeat

Run 3× per tier per fixture (12 combinations × 3 runs = 36 total) as specified in ADR-008.

### Step 5: Compare

```bash
npx tsx evaluations/benchmark-runner.ts --compare --results-dir evaluations/results/
```

Produces `evaluations/results/benchmark-comparison.md` with a full comparison table.

## Decision Gates

From ADR-008:

1. **If Tier A ≈ Tier C** on precision/recall with lower tokens and variance → adopt single-pass (Tier A)
2. **If Tier B > Tier A** significantly on LLM-only issues → adopt hybrid (Tier B)
3. **If Tier C > both** on root cause hit rate → keep multi-agent but optimize token budget
4. **If all tiers ≈ equal** → adopt simplest (Tier A) per Occam's razor

## File Structure

```
evaluations/
├── README.md                  ← this file
├── benchmark-config.ts        ← fixture/tier/threshold definitions
├── benchmark-harness.ts       ← metric computation engine
├── benchmark-runner.ts        ← CLI runner (evaluate + compare)
├── fixtures/
│   ├── bench-ts-express/      ← TypeScript/Express fixture
│   ├── bench-java-spring/     ← Java/Spring Boot fixture
│   ├── bench-angular-app/     ← Angular 18 fixture
│   └── bench-messy-fullstack/ ← Messy fullstack fixture
├── ground-truth/
│   ├── bench-ts-express.json
│   ├── bench-java-spring.json
│   ├── bench-angular-app.json
│   └── bench-messy-fullstack.json
└── results/                   ← generated after runs
    ├── A-bench-ts-express-*.json
    ├── ...
    └── benchmark-comparison.md
```
