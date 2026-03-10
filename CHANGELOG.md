# Changelog

<!-- markdownlint-disable MD024 -->

All notable changes to this project will be documented in this file.

The format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/) and the project aims to follow Semantic Versioning once the `1.0.0` stability contract lands.

## [Unreleased]

### Added

- **Security**: `error-info-leak` rule detects `@ExceptionHandler` methods leaking `e.getMessage()`/`e.toString()` to clients.
- **Security**: `file-upload-no-validation` rule detects `MultipartFile` params without size/type validation.
- **Tech Debt**: JPA anti-pattern detection module (`tech-debt-jpa.ts`) with 6 rules: `jpa-data-on-entity`, `jpa-cascade-all-many-to-one`, `jpa-missing-version`, `jpa-missing-modifying`, `lazy-self-injection`, `jpa-no-migration-tool`.
- **API Design**: `stateful-rest-controller` rule detects `HttpSession` usage in REST controllers.
- **API Design**: `unpaginated-list-endpoint` rule flags `List<>`/`Collection<>` returns without `Pageable`.
- **Tests**: `excessive-assertions` rule flags test files averaging >25 assertions per `@Test` method.
- **Tests**: `missing-test-slicing` rule detects `@SpringBootTest` without slice annotations (`@WebMvcTest`, etc.).
- **Performance**: Sync HTTP (`RestTemplate`), sync mail (`JavaMailSender.send`), and `Runtime.exec()` detection in Java source files.
- **Documentation**: `readme-recommended-section-missing` rule checks for prerequisites, contributing, license, and architecture sections.
- Contributor guide in [CONTRIBUTING.md](CONTRIBUTING.md) covering setup, workflows, quality gates, and pull request expectations.
- Release automation in [.github/workflows/release.yml](.github/workflows/release.yml) to validate, pack, publish, and attach the npm artifact to GitHub releases.
- `npm run release:check` to validate the npm publication path locally with `npm publish --dry-run`.

### Fixed

- **Architecture**: Java package imports (`com.app.domain.Model`) are now normalized to path form before layer detection, fixing false negatives on Java projects.
- **Architecture**: `detectCircularDependencies` now resolves Java package imports to file paths, enabling cycle detection in Java codebases (previously skipped all non-relative imports).
- **API Design**: New `non-kebab-case-path` rule detects camelCase, PascalCase, and snake_case segments in REST route paths.
- **Observability**: `checkObservability` now scans `pom.xml`/`build.gradle` for `spring-boot-starter-actuator` and `application.properties`/`.yml` for Actuator management config, eliminating false-positive "missing health endpoint" findings on Spring Boot projects.

### Changed

- README contributor links now point to the new contribution and release-note guides.
- README now exposes CI, npm version, and test-count badges for release readiness.
- Release documentation now includes the final npm publication checklist and provenance-based publish flow.
- Roadmap progress now marks the contribution guide and changelog work as complete for the v0.8.0 documentation track.
- Root package metadata is now aligned for npm publication, including publishable assets, runtime dependencies, and public registry metadata.
- Package versions are aligned to `0.7.0` across the root package and MCP workspace.

## [0.7.0] - 2026-03-08

### Added

- Claude Code support via generated `CLAUDE.md` and `.mcp.json`
- OpenAI Codex support via generated `AGENTS.md` and `.codex/config.toml`
- `inspectra setup --claude`, `inspectra setup --codex`, `inspectra init <project> --claude`, and `inspectra init <project> --codex`
- Accessibility, API design, observability, and i18n audit agents and MCP tools
- Project-level configuration via `.inspectrarc.yml` / `.inspectrarc.yaml`
- Finding suppression via `.inspectraignore`
- `inspectra doctor` for environment diagnostics

### Changed

- Phase 2 prompts were tuned to improve audit precision and reduce false positives
- Deduplication and scoring behavior were improved across merged reports
- Secret detection became more context-aware with placeholder and comment filtering
- Test coverage expanded to 500+ passing checks across the MCP server and merger pipeline
