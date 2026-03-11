# ADR-007: Diagnostic Intelligence Layer

**Status:** Proposed — gated by [ADR-008](008-benchmark-before-architecture.md) benchmark results  
**Date:** 2026-03-11  
**Deciders:** Core maintainers  

## Context

Inspectra v0.7 delivers broad coverage: 12 domain agents, 42 MCP tools, deduplication, weighted scoring. But the current pipeline has a structural gap that limits the quality of the output:

```
domain agents → flat merge → sort by severity → top 10 → report
```

This pipeline **detects** and **counts**. It does not **diagnose**.

### What's missing

1. **No root cause clustering.** 4 findings from 4 domains pointing at the same God module are reported as 4 independent problems. The user must mentally correlate them.

2. **No cross-domain correlation.** The deduplication layer handles *same rule, same location* but not *different symptoms, same cause*. A file with high complexity (DEBT), layer violations (ARC), low coverage (TST), and naming issues (CNV) is 4 unrelated signals in the current model.

3. **No impact-based prioritization.** Findings are sorted by severity + confidence. There's no concept of blast radius, remediation leverage (fix 1 root cause → resolve N findings), or effort/impact ratio.

4. **No remediation plan.** The report says *what's wrong* but not *what to fix first, in what order, and why*.

5. **Additive penalty scoring.** `score = 100 - Σ(severity_weight × confidence)` is mathematically clean but contextually fragile. A repo with 12 low-severity naming findings loses 36 points from conventions alone, while a repo with 1 critical auth bypass loses 25 from security. The naming repo looks "worse" numerically.

### The risk

Without a diagnostic intelligence layer, Inspectra is an **observation aggregator** — impressive in breadth, weak in judgment. The user gets volume, not insight. They want:

> "What are the 3 real problems, why do they matter, and what do I fix first?"

The current system answers a different question:

> "Here are 30 findings sorted by severity across 12 domains."

## Decision

Introduce a **Diagnostic Intelligence Layer** between the merge and the report phases. This layer transforms flat findings into **root cause clusters**, **prioritized remediation batches**, and an **executive diagnosis**.

### New pipeline

```
Phase 1: Domain scans          (existing — unchanged)
Phase 2: Merge + Dedup          (existing — unchanged)
Phase 3: Correlate + Cluster    (NEW — hotspot detection, root cause inference)
Phase 4: Prioritize + Plan      (NEW — impact scoring, remediation batches)
Phase 5: Report                 (enhanced — diagnosis-first output)
```

## Architecture

### Phase 3 — Correlation Engine

#### 3a. Hotspot Detection

After deduplication, group findings by **convergence point**:

| Hotspot type | Signal | Example |
|---|---|---|
| **File hotspot** | 3+ findings from 2+ domains on the same file | `UserService.java` has SEC + ARC + DEBT + CNV findings |
| **Module hotspot** | 5+ findings across files sharing a common directory | `src/core/` has 12 findings across 4 domains |
| **Dependency hotspot** | Multiple findings tracing to the same external dependency | `lodash@3.x` triggers security + staleness + compatibility |
| **Pattern hotspot** | Same rule triggered 5+ times across different files | `missing-unit-test` on 15 service files = systemic gap |

Implementation: `mcp/src/merger/correlate.ts`

```typescript
interface Hotspot {
  type: "file" | "module" | "dependency" | "pattern";
  anchor: string;                    // file path, module path, dep name, or rule
  findings: Finding[];               // contributing findings
  domains: string[];                 // distinct domains involved
  cross_domain_count: number;        // how many distinct domains
}
```

#### 3b. Root Cause Inference

Each hotspot gets a **root cause hypothesis** — a structured explanation of *why* these findings co-occur:

```typescript
interface RootCauseCluster {
  id: string;                        // RC-001, RC-002, ...
  hotspot: Hotspot;
  hypothesis: string;                // "God module with mixed responsibilities"
  category: RootCauseCategory;       // see taxonomy below
  contributing_findings: string[];   // finding IDs
  severity_ceiling: Severity;        // highest severity in cluster
  blast_radius: number;              // files affected
  remediation_leverage: number;      // fix 1 cause → resolve N findings
}

type RootCauseCategory =
  | "god-module"              // one module does too much
  | "missing-abstraction"     // no layer between concerns
  | "dependency-rot"          // stale/vulnerable external dep
  | "test-gap"                // systemic missing test coverage
  | "convention-drift"        // gradual erosion of standards
  | "misaligned-architecture" // code doesn't match intended patterns
  | "security-shortcut"       // auth/validation bypassed for speed
  | "documentation-debt"      // knowledge trapped in code
  | "isolated";               // no causal link found — standalone finding
```

Root cause inference is **deterministic first, LLM-assisted second**:

1. **Rules-based patterns** (in `policies/root-cause-patterns.yml`):
   - File hotspot + ARC + CNV + DEBT → likely `god-module`
   - Pattern hotspot on `missing-unit-test` → likely `test-gap`
   - Dependency hotspot + SEC + DEBT → likely `dependency-rot`

2. **LLM reasoning** (orchestrator Phase 3 prompt): for hotspots that don't match a known pattern, the orchestrator reads the cluster and proposes a hypothesis with `confidence ≤ 0.6`.

### Phase 4 — Prioritization Engine

#### 4a. Impact Scoring

Replace additive penalty with a multi-factor score per cluster:

```
impact = severity_ceiling × blast_radius × remediation_leverage / effort
```

Where:
- `severity_ceiling`: highest severity in cluster (critical=5, high=4, medium=3, low=2, info=1)
- `blast_radius`: number of distinct files affected by the cluster
- `remediation_leverage`: ratio of findings resolved by fixing the root cause
- `effort`: estimated effort of the root cause fix (trivial=1, small=2, medium=3, large=5, epic=8)

Clusters are ranked by impact score descending. This naturally surfaces high-leverage, low-effort root cause fixes.

#### 4b. Remediation Plan

Group ranked clusters into **action batches**:

```typescript
interface RemediationPlan {
  fix_now: RemediationBatch;      // top 1-3 clusters, highest impact
  next_sprint: RemediationBatch;  // clusters 4-8, structural improvements
  backlog: RemediationBatch;      // remaining, low-impact or high-effort
}

interface RemediationBatch {
  clusters: RootCauseCluster[];
  total_findings_resolved: number;
  estimated_score_improvement: number;
  dependencies: string[];          // "fix RC-001 before RC-003"
}
```

The `estimated_score_improvement` is computed by simulating score recalculation with the cluster's findings removed. This tells the user: "fixing these 2 root causes brings you from 62/100 to 81/100."

### Phase 5 — Enhanced Report

The report structure shifts from domain-first to diagnosis-first:

```
1. Executive Diagnosis (3 sentences max)
   - The 1-3 root causes that matter most
   - Expected score after fixing them
   - Recommended first action

2. Remediation Plan
   - Fix Now: clusters + effort + impact
   - Next Sprint: clusters + effort + impact
   - Backlog: cluster count, tracking only

3. Root Cause Analysis
   - Each cluster: hypothesis, contributing findings, blast radius
   - Causal arrows between clusters (if any)

4. Domain Breakdown (preserved, secondary)
   - Per-domain score + findings (for teams that want domain detail)

5. Score Context
   - Score with caveats: what the number captures and what it doesn't
   - Comparison to profile baseline (if available)
```

### New MCP Tools

| Tool | Purpose |
|---|---|
| `inspectra_correlate_findings` | Detect hotspots, group findings into clusters |
| `inspectra_infer_root_causes` | Assign root cause hypotheses to clusters |
| `inspectra_build_remediation_plan` | Generate prioritized fix batches |

### New Schema

`schemas/root-cause-cluster.schema.json` — defines cluster structure.  
`schemas/remediation-plan.schema.json` — defines plan structure.  
`schemas/consolidated-report.schema.json` — extended with `clusters` and `remediation_plan` fields (backward-compatible: both optional).

### New Policy

`policies/root-cause-patterns.yml` — maps hotspot signatures to root cause categories.

## Consequences

### Positive

- Report answers "what to fix first and why" instead of "here are N findings"
- Cross-domain correlation catches systemic issues that per-domain agents miss
- Remediation leverage metric rewards fixing root causes over patching symptoms
- Score becomes more meaningful: tied to clusters rather than raw finding count
- Backward-compatible: domain agents, tools, and schemas are unchanged

### Negative

- Correlation engine adds complexity to the merger layer
- Root cause inference is partially non-deterministic (LLM-assisted)
- New schemas and tools must be maintained
- Remediation plan quality depends on accurate effort estimates from agents

### Risks

- Over-clustering: grouping unrelated findings under a false root cause
  - Mitigation: conservative rules-based patterns first, LLM only for gaps, always expose contributing findings
- Under-clustering: missing real correlations
  - Mitigation: iterative refinement of `root-cause-patterns.yml` based on audit feedback
- Score simulation can be misleading if findings are interdependent
  - Mitigation: clearly label score improvement as "estimated"

## Migration

Phase 3 and 4 are additive — they sit between existing Phase 2 (merge) and Phase 5 (report). No existing code needs rewriting. The rollout:

1. Implement `correlate.ts` (hotspot detection) + tests
2. Implement `root-cause.ts` (pattern-based inference) + tests
3. Implement `prioritize.ts` (impact scoring + plan) + tests
4. Add new MCP tools (`correlate_findings`, `infer_root_causes`, `build_remediation_plan`)
5. Extend orchestrator prompt with Phase 3-4 instructions
6. Update report renderers to support diagnosis-first layout
7. Add `root-cause-patterns.yml` policy file with initial patterns
