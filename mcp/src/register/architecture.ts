import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { findingsResponse, withErrorHandling } from "./response.js";
import { FindingsOutputSchema, READ_ONLY_ANNOTATIONS, ResponseFormatField, LimitField, OffsetField, ProjectDirField, ProfileField } from "./schemas.js";
import { checkLayering, analyzeModuleDependencies, detectCircularDependencies } from "../tools/architecture.js";
import { loadProfile } from "../policies/loader.js";
import { validateProjectDir } from "../utils/paths.js";

/**
 * Registers all architecture-domain MCP tools on the given server instance.
 *
 * @param server - The MCP server to register tools on.
 * @param policiesDir - Absolute path to the policies directory.
 */
export function registerArchitectureTools(server: McpServer, policiesDir: string): void {
  server.registerTool(
    "inspectra_check_layering",
    {
      title: "Check Layering",
      description: `Verify clean architecture layer dependencies and detect forbidden cross-layer imports.

Enforces a directed dependency graph: presentation -> application -> domain <- infrastructure. Any import that violates this layering produces a finding.

Args:
  - projectDir (string): Absolute path to the project root.
  - profile (string, optional): Policy profile with custom allowed dependencies (e.g., "java-angular-playwright").

Returns: Array of Finding objects (domain: "architecture", prefix: ARC-). Each finding identifies the importing file, the imported module, and the violated layer rule.

Error handling:
  - Throws if projectDir does not exist or is not a directory.

Examples:
  1. Check layering for a TypeScript project:
     { "projectDir": "/app/my-project" }
  2. Check with custom allowed dependencies:
     { "projectDir": "/app/my-project", "profile": "java-angular-playwright" }
  3. Get first 5 violations only:
     { "projectDir": "/app/my-project", "limit": 5 }`,
      inputSchema: {
        projectDir: ProjectDirField,
        profile: ProfileField,
        responseFormat: ResponseFormatField,
        limit: LimitField,
        offset: OffsetField,
      },
      outputSchema: FindingsOutputSchema,
      annotations: READ_ONLY_ANNOTATIONS,
    },
    withErrorHandling(async ({ projectDir, profile, responseFormat, limit, offset }) => {
      const safeDir = await validateProjectDir(projectDir);
      const profileConfig = profile ? await loadProfile(policiesDir, profile) : undefined;
      const findings = await checkLayering(safeDir, profileConfig?.architecture?.allowed_dependencies);
      return findingsResponse(findings, responseFormat, { limit, offset });
    }, "inspectra_check_layering"),
  );

  server.registerTool(
    "inspectra_analyze_dependencies",
    {
      title: "Analyze Dependencies",
      description: `Analyze package.json dependencies for health issues including excessive count, duplicated packages, and missing peer dependencies.

Reads package.json and optional lock files to assess dependency health. Flags bloated dependency trees and potential version conflicts.

Args:
  - projectDir (string): Absolute path to the project root.

Returns: Array of Finding objects (domain: "architecture", prefix: ARC-). Each finding identifies the problematic dependency and the issue type (excessive count, duplication, missing peer).

Error handling:
  - Returns empty findings if no package.json is found.
  - Throws if projectDir does not exist or is not a directory.

Examples:
  1. Analyze dependencies:
     { "projectDir": "/app/my-project" }
  2. Get Markdown dependency report:
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
      const findings = await analyzeModuleDependencies(safeDir);
      return findingsResponse(findings, responseFormat, { limit, offset });
    }, "inspectra_analyze_dependencies"),
  );

  server.registerTool(
    "inspectra_detect_circular_deps",
    {
      title: "Detect Circular Dependencies",
      description: `Detect circular import chains between source files that create tight coupling and complicate module loading.

Builds an import graph from TypeScript/JavaScript source files and runs cycle detection. Each cycle found is reported as a finding.

Args:
  - projectDir (string): Absolute path to the project root.

Returns: Array of Finding objects (domain: "architecture", prefix: ARC-). Each finding includes the full cycle path (A -> B -> C -> A) and affected file paths.

Error handling:
  - Throws if projectDir does not exist or is not a directory.

Examples:
  1. Detect circular imports:
     { "projectDir": "/app/my-project" }
  2. Get first 3 cycles:
     { "projectDir": "/app/monorepo", "limit": 3 }`,
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
      const findings = await detectCircularDependencies(safeDir);
      return findingsResponse(findings, responseFormat, { limit, offset });
    }, "inspectra_detect_circular_deps"),
  );
}