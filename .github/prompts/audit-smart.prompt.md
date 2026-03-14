---
description: "[Experimental] Smart audit — detects the project stack and runs only the relevant MCP tools"
---

> ⚠️ **Experimental** — This prompt is part of v0.8.0 development. Behavior may change.
> Architecture: **Tier B (Hybrid)** with smart tool selection — see [ADR-008](../../evaluations/benchmark-results.md).

Run a smart audit on the project in the current workspace. **First detect the project stack**, then **run only the relevant MCP tools** (Tier B workflow).

## Phase 0 — Project Detection

Use the `search` and `read` tools to probe the project structure. Collect signals:

### Signal Collection

| Signal | How to detect |
|--------|--------------|
| Has frontend templates | `*.html`, `*.component.html`, `*.jsx`, `*.tsx` files exist outside `node_modules` |
| Has Angular | `angular.json` or `*.module.ts` or `*.component.ts` files exist |
| Has React | `*.jsx` or `*.tsx` or `"react"` in `package.json` dependencies |
| Has i18n setup | `src/i18n/`, `assets/i18n/`, `*.translate.pipe.ts`, `TranslateModule` import, or `i18next` in `package.json` |
| Has routes / REST API | `*.controller.ts`, `*.router.ts`, `routes.ts`, `app.routes.ts`, `*.route.ts`, `@Controller` annotation in Java files, `@RestController`, Express `router.get/post/put/delete` |
| Has build config | `webpack.config.*`, `vite.config.*`, `angular.json`, `rollup.config.*`, `esbuild.config.*` |
| Has test files | `*.test.ts`, `*.spec.ts`, `*.test.js`, `*.spec.js`, `__tests__/`, `e2e/`, `coverage/` directory |
| Has service layer | `*.service.ts`, `*.service.java`, try/catch blocks in service files, error handling middleware |
| Has docs | `README.md` with >50 lines, `docs/` directory, `*.md` files in root |
| Has Java / Maven | `pom.xml`, `*.java`, `build.gradle` |
| Has Python | `pyproject.toml`, `setup.py`, `*.py` files |
| Has Node.js | `package.json` in root |
| Is a library/SDK | No `src/app/`, no `main.ts`/`index.html`, only exported modules |
| Is a backend-only project | No `*.html` templates, no UI framework, no CSS/SCSS |

### Tool Selection Rules

There are **three possible states** for each tool group — not two:

| State | Meaning | Report treatment |
|-------|---------|-----------------|
| ✅ **Invoke** | Domain is relevant, signal positive — run the tool group | Full domain score + findings |
| ⚠️ **Skip + Gap** | Signal is absent but the absence is itself a risk — do NOT run the tool group | No score, but surface a gap finding in the report under "Structural Gaps" |
| ❌ **Skip silently** | Domain is genuinely not applicable to this project type | Mention in the skipped list with reason, no findings |

---

**Always run** (every project):
- Security — every project has secrets risk, deps, and auth
- Conventions — every project has code style issues
- Architecture — every project has module structure

**Invoke if signals match / Skip + Gap if absent**:

| Tool group | Invoke when | Skip + Gap when (absence = risk) |
|-------|-------------|----------------------------------|
| Tests (`inspectra_detect_missing_tests`) | Test files (`*.test.*`, `*.spec.*`, `__tests__/`) or coverage directory detected | **No test files found** — surface gap: "No test suite detected. Testing coverage is unknown. Consider adding unit tests." |
| Tech debt (`inspectra_analyze_complexity`, `inspectra_check_dependency_staleness`, `inspectra_detect_deprecated_apis`, `inspectra_detect_code_smells`) | Project has >20 source files | <20 source files — silent skip (likely scaffold) |
| Performance (`inspectra_analyze_bundle_size`, `inspectra_check_build_timings`) | Build config (`webpack`, `vite`, `angular.json`, `rollup`) detected OR `dist/`/`build/` output exists | Build config exists but no `dist/` output yet — invoke anyway. No build config at all in a frontend project — surface gap: "No bundler config detected in a frontend project. Bundle size cannot be assessed." |
| Documentation (`inspectra_check_readme_completeness`, `inspectra_check_adr_presence`, `inspectra_detect_doc_code_drift`) | README with >50 lines OR `docs/` directory with ≥2 files | **README missing or <10 lines** — surface gap: "No meaningful documentation found. A README with setup, usage and architecture sections is strongly recommended." |
| Observability (`inspectra_check_observability`) | Service layer detected (`*.service.ts`, error handlers, middleware, logging imports) | Service layer exists but **no logging library** imported (`winston`, `pino`, `@nestjs/common Logger`, `log4j`, `slf4j`, etc.) — surface gap: "Service layer detected but no structured logging library found. Observability cannot be assessed and may be absent." |
| API design (`inspectra_check_rest_conventions`) | Route files or REST controller annotations detected | No routes detected in a project that has a service layer — surface gap: "A service layer was found but no route definitions detected. If this project exposes an API, route files may be missing or unconventionally named." |

**Skip silently if not applicable**:

| Tool group | Skip silently when |
|-------|-------------------|
| Accessibility (`inspectra_check_a11y_templates`) | No frontend templates (`*.html`, `*.jsx`, `*.tsx`, Angular templates) — backend-only project |
| i18n (`inspectra_check_i18n`) | No frontend templates AND no i18n setup files — truly no UI layer |
| UX consistency (`inspectra_check_ux_consistency`) | No CSS/SCSS/design tokens AND no frontend templates |
| i18n (special case) | Frontend templates exist AND i18n setup already present → invoke. Templates exist but NO i18n setup → **Skip + Gap**: "Frontend templates detected but no i18n library configured. Strings may be hardcoded — consider `ngx-translate`, `i18next`, or equivalent." |

### Detection Output

Before running any tools, output a brief detection summary in the report:

```markdown
### Stack Detection

| Signal | Detected | Value |
|--------|----------|-------|
| Frontend templates | ✅ / ❌ | Angular / React / None |
| Routes / REST API | ✅ / ❌ | Express / Spring / None |
| Build config | ✅ / ❌ | Vite / Webpack / None |
| Test files | ✅ / ❌ | X test files found |
| Service layer | ✅ / ❌ | X service files found |
| Logging library | ✅ / ❌ | winston / pino / None |
| i18n setup | ✅ / ❌ | TranslateModule / i18next / None |
| Docs | ✅ / ❌ | README (XXX lines) + docs/ |

### Tool Plan (X invoked / X gaps / X skipped)

| Tool Group | Status | Reason |
|-------|--------|--------|
| security | ✅ invoke | always required |
| tests | ✅ invoke | 42 test files found |
| architecture | ✅ invoke | always required |
| conventions | ✅ invoke | always required |
| performance | ⚠️ gap | frontend project but no bundler config |
| documentation | ✅ invoke | README (120 lines) + docs/ |
| tech-debt | ✅ invoke | 87 source files |
| accessibility | ❌ skip | no frontend templates (backend-only) |
| api-design | ✅ invoke | 5 controller files detected |
| observability | ⚠️ gap | service layer found but no logging library |
| i18n | ⚠️ gap | Angular templates found but no i18n library |
| ux-consistency | ❌ skip | no frontend templates |
```

## Phase 1 — Run Selected MCP Tools

Run **only** the MCP tools selected in Phase 0. **Paginate all tools**: when `has_more` is `true`, call again with the returned `next_offset` until `has_more` is `false`. Merge all pages per tool.

**Always run** (every project):
- Security: `inspectra_scan_secrets`, `inspectra_check_deps_vulns`, `inspectra_check_security_config`
- Conventions: `inspectra_check_naming`, `inspectra_check_file_lengths`, `inspectra_check_function_lengths`, `inspectra_check_param_counts`, `inspectra_check_magic_numbers`, `inspectra_check_todos`, `inspectra_check_dead_exports`
- Architecture: `inspectra_check_layering`, `inspectra_analyze_dependencies`, `inspectra_detect_circular_deps`

**Conditionally run** (based on Phase 0 detection):
- Tests: `inspectra_detect_missing_tests`
- Tech debt: `inspectra_analyze_complexity`, `inspectra_check_dependency_staleness`, `inspectra_detect_deprecated_apis`, `inspectra_detect_code_smells`
- Performance: `inspectra_analyze_bundle_size`, `inspectra_check_build_timings`
- Documentation: `inspectra_check_readme_completeness`, `inspectra_check_adr_presence`, `inspectra_detect_doc_code_drift`
- Observability: `inspectra_check_observability`
- API design: `inspectra_check_rest_conventions`
- Accessibility: `inspectra_check_a11y_templates`
- i18n: `inspectra_check_i18n`
- UX consistency: `inspectra_check_ux_consistency`

## Phase 2 — Hotspot Detection

After collecting all tool findings, compute **hotspot files**: files that appear in **3 or more findings from 2 or more distinct domains**.

Sort by score (`domains.size × findings.length`) descending. The top 5 hotspot files (if any qualify) will be explored in Phase 3.

## Phase 3 — Conditional Deep Explorer

**Only if hotspot files were found in Phase 2**, read each hotspot file and perform targeted analysis:

For each hotspot file:
1. Read the full file content
2. Cross-reference the tool findings that flagged this file
3. Look for deeper issues tools could not detect (root causes, design-level problems, logic flaws, performance anti-patterns)
4. Produce additional explorer findings with `source: "llm"`, `confidence ≤ 0.7`, IDs starting at 501

**If NO hotspot files qualify**, skip this phase entirely.

## Phase 4 — Structured Domain Synthesis & Merge

With all tool findings AND any explorer findings:

1. **Group** findings by domain and root cause
2. **Score**: Call `inspectra_score_findings` for each audited domain
3. **Merge**: Call `inspectra_merge_domain_reports` with all domain results
4. **Log**: Call `inspectra_log_activity`
5. **Render**: Call `inspectra_render_html`

## Scoring

- Only audited domains contribute to the weighted average (re-normalized at runtime)
- Reference `policies/scoring-rules.yml` for weights — never hardcode them
- Grades: A (90+), B (75+), C (60+), D (40+), F (<40)

## Output Format

```markdown
# Inspectra Smart Audit

> ⚠️ Experimental — tool selection is heuristic-based.
> Architecture: Tier B (Hybrid)

## Stack Detection
(detection table and tool plan — see Phase 0 output format above)

## Executive Summary
- Overall Score: XX/100 (Grade X)
- Findings: X critical, X high, X medium, X low
- Audited domains: X/12 | Gaps flagged: X | Skipped (N/A): X
- Sources: X tool-detected, X explorer-detected
- Explorer triggered: Yes/No | Hotspot files explored: X

## Domain Scores

| Domain | Score | Grade | Findings (tool) | Findings (explorer) | Status |
|--------|-------|-------|-----------------|---------------------|--------|
| Security | XX/100 | X | X | X | ✅ audited |
| Tests | XX/100 | X | X | X | ✅ audited |
| Architecture | XX/100 | X | X | X | ✅ audited |
| Conventions | XX/100 | X | X | X | ✅ audited |
| Performance | — | — | — | — | ⚠️ gap: no bundler config |
| Documentation | XX/100 | X | X | X | ✅ audited |
| Tech Debt | XX/100 | X | X | X | ✅ audited |
| Accessibility | — | — | — | — | ❌ N/A: no templates |
| API Design | XX/100 | X | X | X | ✅ audited |
| Observability | — | — | — | — | ⚠️ gap: no logging library |
| i18n | — | — | — | — | ⚠️ gap: templates without i18n |
| UX Consistency | — | — | — | — | ❌ N/A: no templates |

## Hotspot Files (if explorer triggered)

| File | Domains | Tool Findings | Explorer Findings | Root Cause |
|------|---------|--------------|-------------------|------------|

## Structural Gaps

> These domains were **not audited** because the required setup is missing — but the absence itself is a concern.

| Domain | Gap | Recommendation |
|--------|-----|----------------|
| Performance | No bundler config found in a frontend project | Add `vite.config.ts` or `angular.json` and configure bundle size budgets |
| Observability | Service layer detected but no logging library imported | Add `winston`, `pino`, or equivalent. Instrument service methods. |
| i18n | Angular templates found but no `TranslateModule` / `i18next` | Configure an i18n library before internationalizing user-facing strings |

## Top Priority Findings
(top 10 findings sorted by severity across all audited domains)

## Domain Details
(for each audited domain: all findings grouped by severity)

## Recommendations
(prioritized action items — include both findings-based and gap-based items)

## Detection Confidence
(brief note on ambiguous signals — e.g., "No test files found but `jest.config.js` exists — the tests tool group was included")
```

## Rules

- **Do NOT** invoke domain sub-agents — all domain analysis happens in this single prompt via MCP tools + explorer
- Never skip `inspectra_merge_domain_reports` — always merge via the tool
- Never run a tool that was excluded by the detection logic
- If detection is ambiguous (e.g., no templates found but Angular listed in `package.json`), **run** the uncertain tool group — false inclusion is better than false exclusion
- **Always surface gaps** — if a domain is in ⚠️ Skip + Gap state, it MUST appear in the "Structural Gaps" section
- **Never invent domain scores for gap domains** — gap domains have no score and no grade. Their row in the Domain Scores table shows `—`.
- Gap findings are NOT passed to `inspectra_merge_domain_reports` — they are listed separately in "Structural Gaps"
- ❌ Skip-silently domains must appear in the tool plan table with their reason — never mentioned again in the report body
- Never invent findings — only report what tools and the explorer found
- **Do** paginate all tool calls when `has_more` is `true`
- Apply Rule #1 for any bad output (diagnose → discard → fix → re-run)
