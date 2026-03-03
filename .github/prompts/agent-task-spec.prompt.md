```prompt
---
description: "Write an agent task spec following Stripe Minions principles — no ambiguity, no inference"
---

Write an agent task specification for the following request. The spec must leave NO ambiguity — agents must not need to infer anything.

## Spec Template

Use this exact structure:

### Task: [Specific action verb] [specific target]

**Agent**: [which domain agent should handle this]

#### Input
- **Target path**: [exact path to the project or file]
- **Configuration**: [specific config, profile, or defaults]
- **Constraints**: [any limits — file count, timeout, scope restrictions]

#### Expected Output
- **Format**: JSON matching `schemas/domain-report.schema.json`
- **Required fields**: domain, score, summary, findings[], metadata
- **Finding IDs**: Must match `DOMAIN_PREFIX-XXX` pattern
- **Validation**: Every finding has evidence with file path + line number

#### Scope
- **IN**: [exact files/directories/patterns to examine]
- **OUT**: [exact files/directories/patterns to skip — test fixtures, examples, docs, node_modules, dist]

#### Success Criteria
- [ ] All MCP tools were called and produced data
- [ ] Every finding has tool-backed evidence (no hallucinations)
- [ ] No findings reference files outside the declared scope
- [ ] JSON output passes schema validation
- [ ] Score is computed from actual findings, not guessed

#### Failure Protocol
If MCP tools are unavailable or the agent produces malformed output:
1. Diagnose the root cause
2. Discard the output entirely
3. Fix the cause (prompt, tool input, data)
4. Re-run from scratch (Rule #1: Never fix bad output)

---

## Rules for Writing Specs

1. **Be specific** — file paths, line numbers, code snippets, exact formats
2. **Never say "improve" or "clean up"** — specify what exactly should change
3. **Define boundaries** — what's IN scope and what's OUT of scope
4. **Make success measurable** — checkboxes that can be verified
5. **Include failure protocol** — what happens when things go wrong

Apply these rules to the user's request and produce a complete spec.
```
