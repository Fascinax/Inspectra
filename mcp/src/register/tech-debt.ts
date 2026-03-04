import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { findingsResponse, withErrorHandling } from "./response.js";
import { FindingsOutputSchema, READ_ONLY_ANNOTATIONS, ResponseFormatField, LimitField, OffsetField, ProjectDirField } from "./schemas.js";
import { analyzeComplexity, ageTodos, checkDependencyStaleness } from "../tools/tech-debt.js";
import { validateProjectDir } from "../utils/paths.js";

/**
 * Registers all tech-debt-domain MCP tools on the given server instance.
 */
export function registerTechDebtTools(server: McpServer): void {
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
      inputSchema: {
        projectDir: ProjectDirField,
        responseFormat: ResponseFormatField,
        limit: LimitField,
        offset: OffsetField,
      },
      outputSchema: FindingsOutputSchema,
      annotations: READ_ONLY_ANNOTATIONS,
    },
    withErrorHandling(async ({ projectDir, responseFormat, limit, offset }) => {
      const safeDir = await validateProjectDir(projectDir);
      const findings = await analyzeComplexity(safeDir);
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
      inputSchema: {
        projectDir: ProjectDirField,
        responseFormat: ResponseFormatField,
        limit: LimitField,
        offset: OffsetField,
      },
      outputSchema: FindingsOutputSchema,
      annotations: READ_ONLY_ANNOTATIONS,
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
      inputSchema: {
        projectDir: ProjectDirField,
        responseFormat: ResponseFormatField,
        limit: LimitField,
        offset: OffsetField,
      },
      outputSchema: FindingsOutputSchema,
      annotations: READ_ONLY_ANNOTATIONS,
    },
    withErrorHandling(async ({ projectDir, responseFormat, limit, offset }) => {
      const safeDir = await validateProjectDir(projectDir);
      const findings = await checkDependencyStaleness(safeDir);
      return findingsResponse(findings, responseFormat, { limit, offset });
    }, "inspectra_check_dependency_staleness"),
  );
}