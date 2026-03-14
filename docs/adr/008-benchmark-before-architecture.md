# ADR-008: Benchmark Before Architecture

**Status:** Accepted  
**Date:** 2026-03-14  
**Deciders:** Core maintainers  
**Supersedes:** ADR-007 (Diagnostic Intelligence Layer — still valid as design target, built on Tier B foundation)  
**Verdict:** Tier B (Hybrid) — see [benchmark-results.md](../../evaluations/benchmark-results.md)

## Context

ADR-007 proposed adding a Diagnostic Intelligence Layer (correlation, root cause inference, prioritization) on top of the current multi-agent architecture. The design is sound, but it assumes the current architecture is the right foundation.

The harder question is: **does the multi-agent, multi-domain architecture actually produce better diagnostics than simpler alternatives?**

Adding complexity (12 agents, 42 tools, Phase 2 LLM exploration per agent) has costs:

- **Token cost**: each agent gets a full prompt + reads code + produces findings
- **Latency**: sequential handoffs, 12 agent invocations for a full audit
- **Variance**: LLM findings (Phase 2) are non-deterministic across runs
- **Noise**: more agents = more findings ≠ better findings
- **Duplication**: cross-domain overlap requires dedup that may lose signal
- **Debug difficulty**: when the final report is wrong, which agent broke it?
- **Calibration pain**: 12 agents × 2 phases = 24 sources to tune

Before investing in a diagnostic layer (ADR-007), we need empirical evidence that the current architecture outperforms simpler designs — or evidence that it doesn't, forcing a structural rethink.

## Decision

**Benchmark three architecture tiers against the same target projects, using the same evaluation criteria, before committing to any architectural evolution.**

### The three tiers

#### Tier A — Baseline Simple

```text
1 orchestrator prompt
    → calls ALL deterministic MCP tools (scan_secrets, check_todos, etc.)
    → collects tool findings
    → 1 LLM synthesis pass: deduplicate, prioritize, produce report
No sub-agents. No handoffs. No Phase 2 exploration.
```

**Properties:**

- Deterministic tool layer is identical to current Phase 1
- Single LLM call for synthesis (replaces 12 agent handoffs + Phase 2 + merge)
- Fastest, cheapest, most reproducible
- The LLM sees ALL tool findings at once → can cross-correlate natively

#### Tier B — Hybrid

```text
1 orchestrator prompt
    → calls ALL deterministic MCP tools
    → 1 LLM analysis pass per domain group (security, tests, arch, etc.)
       but as structured sections in a SINGLE prompt, not separate agents
    → 1 explorer agent triggered ONLY if:
       - a file appears in 3+ tool findings from 2+ domains (hotspot signal)
       - or a critical finding needs context verification
    → 1 LLM synthesis pass: fuse, prioritize, report
```

**Properties:**

- Tool layer identical to Tier A
- Domain analysis happens in one prompt with structured sections (not 12 separate agents)
- Explorer agent is conditional — only fires on high-signal hotspots
- Moderate cost, moderate latency, lower variance than Tier C

#### Tier C — Deep Multi-Agent (current architecture)

```text
1 orchestrator
    → 12 domain agent handoffs
    → each agent: Phase 1 (tools) + Phase 2 (LLM code exploration)
    → orchestrator: merge + dedup + score + report
```

**Properties:**

- Current system
- Highest token cost, highest latency
- Most findings, most variance
- Phase 2 exploration can catch deep issues tools miss — but at what signal/noise ratio?

### What we measure

#### Primary metrics (quality)

| Metric | Description | How measured |
| --- | --- | --- |
| **Precision** | % of findings that a senior dev confirms as real issues | Expert review panel on blind reports |
| **Recall** | % of known issues in the target repo that were detected | Pre-seeded ground truth + expert additions |
| **Root cause hit rate** | % of reports where the top-3 findings identify an actual root cause (not just symptoms) | Expert review: "would you plan fixes from this?" |
| **Actionability score** | Expert rating 1-5: "could I plan a sprint from this report alone?" | Blind expert scoring |
| **Dedup effectiveness** | % of findings that are genuinely distinct (not reformulations) | Expert dedup review |

#### Secondary metrics (cost)

| Metric | Description |
| --- | --- |
| **Token count** | Total input + output tokens across all LLM calls |
| **Latency** | Wall-clock time from audit start to final report |
| **Variance** | Standard deviation of scores/findings across 3 runs on the same repo |
| **Finding count** | Raw number of findings (lower is better if precision is equal) |

#### The key ratio

```text
diagnostic_value = (precision × recall × actionability) / (token_cost × variance)
```

If Tier A achieves 80% of Tier C's diagnostic value at 15% of the cost and 30% of the variance, then **Tier C's complexity is not justified** and should be simplified.

### Target repos for the benchmark

Minimum 3 repos, ideally 5:

| Repo | Stack | Why |
| --- | --- | --- |
| **sample-project** (internal fixture) | TypeScript/Express | Controlled, known ground truth |
| **Real project 1** | Java/Spring + Angular | Tests multi-stack profile |
| **Real project 2** | TypeScript/Node | Tests single-stack depth |
| **Open-source project** (small, well-known) | Any | Tests on code neither we nor the LLM "memorized" |
| **Intentionally messy repo** | Any | Stress test: many issues, overlapping domains |

For each, we establish a **ground truth document**: the 5-10 real issues a senior dev would identify, ranked by importance, with root causes identified.

### Evaluation protocol

1. Run each tier (A, B, C) on each target repo — 3 runs per tier to measure variance
2. Blind the reports: strip tier labels, randomize order
3. Expert panel (2-3 senior devs) scores each report on precision, recall, root cause hit rate, actionability
4. Compute diagnostic_value ratio for each tier
5. Statistical comparison: is Tier C significantly better than A or B? At what confidence?

### Implementation plan

| Step | Deliverable | Depends on |
| --- | --- | --- |
| 1. Ground truth docs | `evaluations/ground-truth/<repo>.json` for each target repo | Expert time |
| 2. Tier A prompt | `.github/prompts/audit-tier-a.prompt.md` — single-pass orchestrator | Existing MCP tools |
| 3. Tier B prompt | `.github/prompts/audit.prompt.md` — hybrid with conditional explorer | Existing MCP tools |
| 4. Eval harness | `evaluations/benchmark-harness.ts` — runs all tiers, collects metrics | Tier A + B prompts |
| 5. Run benchmark | 3 tiers × 3-5 repos × 3 runs = 27-45 audit runs | Everything above |
| 6. Analysis | `evaluations/benchmark-results.md` — comparison table + verdict | Expert review |
| 7. Architectural decision | Commit to Tier A, B, or C (or a variant) for v0.9+ | Analysis |

### Decision gates

After the benchmark:

- **If Tier A ≈ Tier C on diagnostic_value**: simplify radically. Drop multi-agent, keep tools + single synthesis. ADR-007 intelligence layer applies to a simpler foundation.
- **If Tier B > Tier A but ≈ Tier C**: adopt Tier B. Conditional exploration is the sweet spot. Reduce agent count from 12 to 1 orchestrator + 1 conditional explorer.
- **If Tier C >> Tier B >> Tier A**: current architecture is justified. Proceed with ADR-007 as designed.
- **If all tiers are ≈ on quality but Tier C costs 10x more**: cost efficiency wins. Simplify.

## Consequences

### Positive

- Architecture decisions are grounded in evidence, not intuition
- May discover that most diagnostic value comes from deterministic tools + a single good synthesis
- Identifies where LLM exploration actually adds value vs. where it adds noise
- Prevents investing in complexity that doesn't improve the end user's experience
- Ground truth documents become a permanent evaluation asset

### Negative

- Benchmark requires expert reviewers (2-3 senior devs, ~4 hours each)
- 27-45 audit runs cost tokens and time
- Tier A was new and Tier B required a migration of the default `/audit` workflow
- May invalidate significant existing work if simpler tiers win
- Delays ADR-007 implementation until benchmark completes

### Risks

- **Benchmark gaming**: tiers shouldn't be optimized to win the benchmark — they should represent natural architectural choices
  - Mitigation: freeze prompts before running, no tuning between runs
- **Small sample size**: 3-5 repos may not generalize
  - Mitigation: include diverse stacks, include intentionally messy repo
- **Expert bias**: reviewers may prefer familiar output styles
  - Mitigation: blind reviews, structured rubric

## Relationship to ADR-007

ADR-007 (Diagnostic Intelligence Layer) is **not invalidated** by this ADR. The diagnostic layer (correlation, root cause, prioritization) is valuable regardless of which tier wins. The question is: **which tier is the right foundation** for that layer?

- If Tier A wins → diagnostic layer is built into the single synthesis prompt
- If Tier B wins → diagnostic layer is split between structured analysis and the explorer
- If Tier C wins → diagnostic layer is added as Phase 3-4 per ADR-007
