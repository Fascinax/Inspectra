import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { findingsResponse, withErrorHandling } from "./response.js";
import { STANDARD_INPUT_SCHEMA, PROFILED_INPUT_SCHEMA, FINDINGS_TOOL_META } from "./schemas.js";
import { analyzeComplexity, ageTodos, checkDependencyStaleness } from "../tools/tech-debt.js";
import { checkDeadExports, detectDeprecatedApis, detectCodeSmells } from "../tools/tech-debt-smells.js";
import { loadProfile } from "../policies/loader.js";
import { validateProjectDir } from "../utils/paths.js";

/**
 * Registers all tech-debt-domain MCP tools on the given server instance.
 */
export function registerTechDebtTools(server: McpServer, policiesDir: string): void {
  server.registerTool(
    "inspectra_analyze_complexity",
    {
      title: "Analyze Complexity",
      description: `Estimate code complexity using line count, nesting depth, and function length heuristics to flag high-maintenance files.

Scans TypeScript, JavaScript, and Java source files. Computes a composite complexity score per file based on total lines, maximum nesting depth, number of functions exceeding 50 lines, and parameter counts.

Args:
  - projectDir (string): Absolute path to the project root.

Returns: Array of Finding objects (domain: "tech-debt", prefix: DEBT-). Each finding identifies the complex file, its complexity score, and the dominant complexity driver.

Error handling:
  - Throws if projectDir does not exist or is not a directory.

Examples:
  1. Analyze code complexity:
     { "projectDir": "/app/my-project" }
  2. Get top 5 most complex files:
     { "projectDir": "/app/my-project", "limit": 5 }`,
      inputSchema: PROFILED_INPUT_SCHEMA,
      ...FINDINGS_TOOL_META,
    },
    withErrorHandling(async ({ projectDir, profile, responseFormat, limit, offset }) => {
      const safeDir = await validateProjectDir(projectDir);
      const profileConfig = profile ? await loadProfile(policiesDir, profile) : undefined;
      const findings = await analyzeComplexity(safeDir, undefined, profileConfig);
      return findingsResponse(findings, responseFormat, { limit, offset });
    }, "inspectra_analyze_complexity"),
  );

  server.registerTool(
    "inspectra_age_todos",
    {
      title: "Age TODOs",
      description: `Find aged TODO and FIXME comments by extracting inline dates and computing their age in days.

Searches for TODO/FIXME markers with date patterns like "TODO(2023-01-15)" or "FIXME 2024/03/01". Reports findings for markers older than 90 days, indicating stale technical debt.

Args:
  - projectDir (string): Absolute path to the project root.

Returns: Array of Finding objects (domain: "tech-debt", prefix: DEBT-). Each finding includes the marker text, file path, line number, date found, and age in days.

Error handling:
  - Returns empty findings if no dated TODO markers are found.
  - Throws if projectDir does not exist or is not a directory.

Examples:
  1. Find aged TODO markers:
     { "projectDir": "/app/my-project" }
  2. Get aged TODOs in Markdown:
     { "projectDir": "/app/my-project", "responseFormat": "markdown" }`,
      inputSchema: STANDARD_INPUT_SCHEMA,
      ...FINDINGS_TOOL_META,
    },
    withErrorHandling(async ({ projectDir, responseFormat, limit, offset }) => {
      const safeDir = await validateProjectDir(projectDir);
      const findings = await ageTodos(safeDir);
      return findingsResponse(findings, responseFormat, { limit, offset });
    }, "inspectra_age_todos"),
  );

  server.registerTool(
    "inspectra_check_dependency_staleness",
    {
      title: "Check Dependency Staleness",
      description: `Detect dependency staleness risks by analyzing version pinning patterns in package.json and pom.xml manifests.

Flags dependencies using wildcard ranges (>=, *), very old pinned versions, and packages without lock file entries. Stale dependencies increase security and compatibility risks.

Args:
  - projectDir (string): Absolute path to the project root.

Returns: Array of Finding objects (domain: "tech-debt", prefix: DEBT-). Each finding identifies the stale dependency, its current version specifier, and the staleness risk type.

Error handling:
  - Returns empty findings if no manifest files are found.
  - Throws if projectDir does not exist or is not a directory.

Examples:
  1. Check dependency staleness:
     { "projectDir": "/app/my-project" }
  2. Get staleness report paginated:
     { "projectDir": "/app/monorepo", "limit": 20, "offset": 0 }`,
      inputSchema: STANDARD_INPUT_SCHEMA,
      ...FINDINGS_TOOL_META,
    },
    withErrorHandling(async ({ projectDir, responseFormat, limit, offset }) => {
      const safeDir = await validateProjectDir(projectDir);
      const findings = await checkDependencyStaleness(safeDir);
      return findingsResponse(findings, responseFormat, { limit, offset });
    }, "inspectra_check_dependency_staleness"),
  );

  server.registerTool(
    "inspectra_check_dead_exports",
    {
      title: "Check Dead Exports",
      description: `Detect exported symbols that are never imported by any other file in the project.

Scans TypeScript and JavaScript source files for exported functions, classes, constants, types, and interfaces. For each exported symbol, checks whether any other file in the project imports or references it.

Dead exports widen the public API surface without value and increase maintenance burden.

Args:
  - projectDir (string): Absolute path to the project root.

Returns: Array of Finding objects (domain: "tech-debt", prefix: DEBT-, IDs 300+). Each finding identifies the unused exported symbol, its file, and recommends removal.

Error handling:
  - Throws if projectDir does not exist or is not a directory.
  - Limited to 20 findings to avoid noise in large codebases.

Examples:
  1. Find dead exports:
     { "projectDir": "/app/my-project" }
  2. Get results as Markdown:
     { "projectDir": "/app/my-project", "responseFormat": "markdown" }`,
      inputSchema: STANDARD_INPUT_SCHEMA,
      ...FINDINGS_TOOL_META,
    },
    withErrorHandling(async ({ projectDir, responseFormat, limit, offset }) => {
      const safeDir = await validateProjectDir(projectDir);
      const findings = await checkDeadExports(safeDir);
      return findingsResponse(findings, responseFormat, { limit, offset });
    }, "inspectra_check_dead_exports"),
  );

  server.registerTool(
    "inspectra_detect_deprecated_apis",
    {
      title: "Detect Deprecated APIs",
      description: `Detect usage of known deprecated framework APIs in source files.

Pattern-based detection for deprecated APIs across Angular, React, TypeORM, Spring Boot, and Node.js. Each detected usage includes the deprecated symbol, its framework, and the recommended modern replacement.

Args:
  - projectDir (string): Absolute path to the project root.

Returns: Array of Finding objects (domain: "tech-debt", prefix: DEBT-, IDs 350+). Each finding reports the deprecated symbol, file location, framework, and replacement API.

Error handling:
  - Throws if projectDir does not exist or is not a directory.
  - Skips import lines and comments (only flags actual usage).

Examples:
  1. Detect deprecated API usage:
     { "projectDir": "/app/my-project" }
  2. Get results paginated:
     { "projectDir": "/app/my-project", "limit": 10, "offset": 0 }`,
      inputSchema: STANDARD_INPUT_SCHEMA,
      ...FINDINGS_TOOL_META,
    },
    withErrorHandling(async ({ projectDir, responseFormat, limit, offset }) => {
      const safeDir = await validateProjectDir(projectDir);
      const findings = await detectDeprecatedApis(safeDir);
      return findingsResponse(findings, responseFormat, { limit, offset });
    }, "inspectra_detect_deprecated_apis"),
  );

  server.registerTool(
    "inspectra_detect_code_smells",
    {
      title: "Detect Code Smells",
      description: `Detect structural code smells: God classes and deeply nested code.

God classes are classes with too many methods (>10) or too many lines (>500), violating the Single Responsibility Principle. Deep nesting flags code nested more than 4 levels deep, indicating complex branching.

Args:
  - projectDir (string): Absolute path to the project root.

Returns: Array of Finding objects (domain: "tech-debt", prefix: DEBT-, IDs 400+). Each finding reports the smell type (god-class or deep-nesting), location, and actionable refactoring advice.

Error handling:
  - Throws if projectDir does not exist or is not a directory.
  - Skips test infrastructure directories.

Examples:
  1. Detect code smells:
     { "projectDir": "/app/my-project" }
  2. Get results as Markdown:
     { "projectDir": "/app/my-project", "responseFormat": "markdown" }`,
      inputSchema: STANDARD_INPUT_SCHEMA,
      ...FINDINGS_TOOL_META,
    },
    withErrorHandling(async ({ projectDir, responseFormat, limit, offset }) => {
      const safeDir = await validateProjectDir(projectDir);
      const findings = await detectCodeSmells(safeDir);
      return findingsResponse(findings, responseFormat, { limit, offset });
    }, "inspectra_detect_code_smells"),
  );
}