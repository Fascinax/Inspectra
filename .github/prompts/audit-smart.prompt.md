---
description: "[Experimental] Smart audit — the orchestrator detects the project stack and selects only the relevant domain agents"
agent: audit-orchestrator
---

> ⚠️ **Experimental** — This prompt is part of v0.8.0 development. Behavior may change. Report unexpected agent selections as issues.

Run a smart audit on the project in the current workspace. The orchestrator **first detects the project stack**, then **selects only the relevant domain agents**.

## Phase 0 — Project Detection (run before invoking any agent)

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

### Agent Selection Rules

There are **three possible states** for each agent — not two:

| State | Meaning | Report treatment |
|-------|---------|-----------------|
| ✅ **Invoke** | Domain is relevant, signal positive — run the agent | Full domain score + findings |
| ⚠️ **Skip + Gap** | Signal is absent but the absence is itself a risk — do NOT run the agent | No score, but surface a gap finding in the report under "Structural Gaps" |
| ❌ **Skip silently** | Domain is genuinely not applicable to this project type | Mention in the skipped-agents list with reason, no findings |

---

**Always invoke** (every project):
- `audit-security` — every project has secrets risk, deps, and auth
- `audit-conventions` — every project has code style issues
- `audit-architecture` — every project has module structure

**Invoke if signals match / Skip + Gap if absent**:

| Agent | Invoke when | Skip + Gap when (absence = risk) |
|-------|-------------|----------------------------------|
| `audit-tests` | Test files (`*.test.*`, `*.spec.*`, `__tests__/`) or coverage directory detected | **No test files found** — surface gap: "No test suite detected. Testing coverage is unknown. Consider adding unit tests." |
| `audit-tech-debt` | Project has >20 source files | <20 source files — silent skip (likely scaffold) |
| `audit-performance` | Build config (`webpack`, `vite`, `angular.json`, `rollup`) detected OR `dist/`/`build/` output exists | Build config exists but no `dist/` output yet — invoke anyway. No build config at all in a frontend project — surface gap: "No bundler config detected in a frontend project. Bundle size cannot be assessed." |
| `audit-documentation` | README with >50 lines OR `docs/` directory with ≥2 files | **README missing or <10 lines** — surface gap: "No meaningful documentation found. A README with setup, usage and architecture sections is strongly recommended." |
| `audit-observability` | Service layer detected (`*.service.ts`, error handlers, middleware, logging imports) | Service layer exists but **no logging library** imported (`winston`, `pino`, `@nestjs/common Logger`, `log4j`, `slf4j`, etc.) — surface gap: "Service layer detected but no structured logging library found. Observability cannot be assessed and may be absent." |
| `audit-api-design` | Route files or REST controller annotations detected | No routes detected in a project that has a service layer — surface gap: "A service layer was found but no route definitions detected. If this project exposes an API, route files may be missing or unconventionally named." |

**Skip silently if not applicable**:

| Agent | Skip silently when |
|-------|-------------------|
| `audit-accessibility` | No frontend templates (`*.html`, `*.jsx`, `*.tsx`, Angular templates) — backend-only project |
| `audit-i18n` | No frontend templates AND no i18n setup files — truly no UI layer |
| `audit-ux-consistency` | No CSS/SCSS/design tokens AND no frontend templates |
| `audit-i18n` (special case) | Frontend templates exist AND i18n setup already present → invoke. Templates exist but NO i18n setup → **Skip + Gap**: "Frontend templates detected but no i18n library configured. Strings may be hardcoded — consider `ngx-translate`, `i18next`, or equivalent." |

### Detection Output

Before invoking any agents, output a brief detection summary in the report:

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

### Agent Plan (X invoked / X gaps / X skipped)

| Agent | Status | Reason |
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

## Phase 1 — Invoke Selected Agents in Parallel

Invoke only the agents selected in Phase 0, passing the project path to each.

## Phase 2 — Collect, Validate, Merge

1. Collect all domain reports (must conform to `schemas/domain-report.schema.json`)
2. Validate each report per the orchestrator's Validation Gate
3. Call `inspectra_merge_domain_reports` with all collected domain reports and `projectDir`
4. Log audit activity with `inspectra_log_activity`
5. Render HTML report with `inspectra_render_html`

## Scoring

- Only audited domains contribute to the weighted average (re-normalized at runtime)
- Reference `policies/scoring-rules.yml` for weights — never hardcode them
- Grades: A (90+), B (75+), C (60+), D (40+), F (<40)

## Output Format

```markdown
# Inspectra Smart Audit

> ⚠️ Experimental — agent selection is heuristic-based.

## Stack Detection
(detection table and agent plan — see Phase 0 output format above)

## Executive Summary
- Overall Score: XX/100 (Grade X)
- Findings: X critical, X high, X medium, X low
- Audited domains: X/12 | Gaps flagged: X | Skipped (N/A): X
- Sources: X tool-detected, X LLM-detected

## Domain Scores

| Domain | Score | Grade | Findings | Status |
|--------|-------|-------|----------|--------|
| Security | XX/100 | X | X | ✅ audited |
| Tests | XX/100 | X | X | ✅ audited |
| Architecture | XX/100 | X | X | ✅ audited |
| Conventions | XX/100 | X | X | ✅ audited |
| Performance | — | — | — | ⚠️ gap: no bundler config |
| Documentation | XX/100 | X | X | ✅ audited |
| Tech Debt | XX/100 | X | X | ✅ audited |
| Accessibility | — | — | — | ❌ N/A: no templates |
| API Design | XX/100 | X | X | ✅ audited |
| Observability | — | — | — | ⚠️ gap: no logging library |
| i18n | — | — | — | ⚠️ gap: templates without i18n |
| UX Consistency | — | — | — | ❌ N/A: no templates |

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
(brief note on ambiguous signals — e.g., "No test files found but `jest.config.js` exists — audit-tests was included")
```

## Rules

- Never skip `inspectra_merge_domain_reports` — always merge via the tool
- Never invoke an agent that was excluded by the detection logic
- If detection is ambiguous (e.g., no templates found but Angular listed in `package.json`), **invoke** the uncertain agent — false inclusion is better than false exclusion
- **Always surface gaps** — if a domain is in ⚠️ Skip + Gap state, it MUST appear in the "Structural Gaps" section of the report with a concrete recommendation. Never silently drop a gap.
- **Never invent domain scores for gap domains** — gap domains have no score and no grade. Their row in the Domain Scores table shows `—`.
- Gap findings are NOT passed to `inspectra_merge_domain_reports` (they are editorial observations, not agent outputs). They are listed separately in the "Structural Gaps" section.
- ❌ Skip-silently domains must appear in the agent plan table with their reason — they are never mentioned again in the body of the report.
- Never invent findings — only report what agents found
- Apply Rule #1 for any bad domain report output (diagnose → discard → fix → re-invoke)
