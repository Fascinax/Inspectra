# Inspectra

Multi-agent code audit system using MCP tools. 13 agents across 12 domains, coordinated by an orchestrator.

## Quick Reference

```bash
npm install        # install deps
npm run build      # compile MCP server → mcp/dist/
npm test           # 750+ tests (Vitest)
npm run lint       # tsc --noEmit + ESLint
```

## Project Structure

- `.github/agents/` — 13 Copilot agent definitions (`.agent.md`)
- `.github/prompts/` — `/audit` and `/audit-pr` entry points
- `mcp/src/` — MCP server (TypeScript, ES2022, Node 20+)
  - `tools/` — domain tool implementations (one file per domain)
  - `register/` — tool registration with input/output schemas
  - `merger/` — scoring engine, deduplication, merge
  - `policies/` — YAML policy loader, scoring defaults
  - `renderer/` — HTML, PDF, Markdown, SARIF, JSON renderers
  - `utils/` — shared utilities (files, paths, project-config, finding-builder, shared-constants)
- `schemas/` — JSON Schema 2020-12 contracts (finding, domain-report, consolidated-report)
- `policies/` — scoring-rules.yml, severity-matrix.yml, profiles/
- `bin/init.mjs` — CLI entry point (`inspectra setup`, `inspectra setup --claude`, `inspectra setup --codex`, `inspectra init`, `inspectra doctor`)

## Architecture Rules

- Every MCP tool is prefixed `inspectra_` and registered in a `register/*.ts` file
- Tool functions live in `tools/*.ts`, register files in `register/*.ts` — keep them separate
- All tool responses use `findingsResponse()` or `jsonResponse()` from `register/response.ts`
- Handler registration uses factory functions from `register/handler-factory.ts`: `createStandardHandler`, `createConfigHandler`, `createProfiledHandler`
- Input schemas use `STANDARD_INPUT_SCHEMA` or `PROFILED_INPUT_SCHEMA` from `register/schemas.ts`
- Shared constants (`MAX_SNIPPET_LENGTH`, `SUPPORTED_EXTENSIONS`, `TEST_INFRA_PATH`) live in `utils/shared-constants.ts`
- Use `FindingBuilder` from `utils/finding-builder.ts` for constructing findings in tool functions
- Findings must match `schemas/finding.schema.json` — domain enum: security, tests, architecture, conventions, performance, documentation, tech-debt, accessibility, api-design, observability, i18n, ux-consistency
- Finding IDs: tool-detected `001-499` (source: "tool", confidence ≥ 0.8), LLM-detected `501+` (source: "llm", confidence ≤ 0.7)
- Prefixes: SEC-, TST-, ARC-, CNV-, PRF-, DOC-, DEBT-, ACC-, API-, OBS-, INT-, UX-

## Scoring

Weights (re-normalized at runtime): security 24%, tests 20%, architecture 16%, conventions 12%, performance 10%, documentation 8%, tech-debt 10%, accessibility 8%, api-design 7%, observability 6%, i18n 5%, ux-consistency 6%. See `policies/scoring-rules.yml`.

## Testing Conventions

- Tests in `mcp/src/__tests__/` using Vitest
- Temp directories via `mkdirSync(join(tmpdir(), "inspectra-test-..."))`, cleaned in `afterEach`
- No mocking of file system — use real temp dirs
- Run `npx tsc --noEmit --project mcp/tsconfig.src.json` before committing

## MCP Tools (42 total)

Security: `scan_secrets`, `check_deps_vulns`, `run_semgrep`, `check_maven_deps`, `check_security_config` (includes error-info-leak, file-upload-no-validation)
Tests: `parse_coverage`, `parse_test_results`, `detect_missing_tests`, `parse_playwright_report`, `detect_flaky_tests`, `check_test_quality` (includes excessive-assertions, missing-test-slicing)
Architecture: `check_layering`, `analyze_dependencies`, `detect_circular_deps`
Conventions: `check_naming`, `check_file_lengths`, `check_todos`, `parse_lint_output`, `detect_dry_violations`, `check_function_lengths`, `check_param_counts`, `check_magic_numbers`
Performance: `analyze_bundle_size`, `check_build_timings`, `detect_runtime_metrics` (includes sync-http, sync-mail, runtime-exec for Java)
Documentation: `check_readme_completeness`, `check_adr_presence`, `detect_doc_code_drift`, `detect_env_example_drift`
Tech-debt: `analyze_complexity`, `age_todos`, `check_dependency_staleness`, `check_dead_exports`, `detect_deprecated_apis`, `detect_code_smells` (includes JPA anti-patterns: @Data on entity, CascadeType.ALL, missing @Version/@Modifying, @Lazy self-injection, missing DB migration tool)
Accessibility: `check_a11y_templates`
API Design: `check_rest_conventions` (includes stateful-rest-controller, unpaginated-list-endpoint)
Observability: `check_observability`
i18n: `check_i18n`
UX Consistency: `check_ux_consistency`
Orchestrator: `merge_domain_reports`, `score_findings`
Report: `render_html`, `render_pdf`, `render_trend`, `compare_reports`
Governance: `log_activity`, `read_activity_log`
Adapter: `generate_claude_md`, `generate_codex_agents_md`

## Pagination

All finding tools return paginated responses (default page size: 20). Every response includes `has_more` and `next_offset`. **Always paginate when `has_more: true`** — call the tool again with the returned `next_offset` until `has_more: false`, then merge all pages. Skipping pagination silently drops findings beyond the first page.

## Do NOT

- Modify `schemas/`, `policies/`, or `.github/agents/` without explicit approval
- Run `git push` or any remote-mutating command
- Install new dependencies without confirmation
- Use hardcoded scoring weights — always read from `policies/scoring-rules.yml`
