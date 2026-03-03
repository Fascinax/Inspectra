import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { findingsResponse, withErrorHandling } from "./response.js";
import { FindingsOutputSchema, ResponseFormatField, LimitField, OffsetField } from "./schemas.js";
import {
  checkNamingConventions,
  checkFileLengths,
  checkTodoFixmes,
  parseLintOutput,
  detectDryViolations,
} from "../tools/conventions.js";
import { loadProfile } from "../policies/loader.js";
import { validateProjectDir } from "../utils/paths.js";

/**
 * Registers all conventions-domain MCP tools on the given server instance.
 *
 * @param server - The MCP server to register tools on.
 * @param policiesDir - Absolute path to the policies directory.
 */
export function registerConventionsTools(server: McpServer, policiesDir: string): void {
  server.registerTool(
    "inspectra_check_naming",
    {
      title: "Check Naming",
      description: `Verify file and class naming conventions against community and project standards.

Checks that file names follow kebab-case (TypeScript/JavaScript) or PascalCase (Java), and that exported class/interface names match their file names. Detects inconsistent casing and abbreviations.

Args:
  - projectDir (string): Absolute path to the project root.

Returns: Array of Finding objects (domain: "conventions", prefix: CNV-). Each finding identifies the file with the naming violation, the current name, and the expected pattern.

Error handling:
  - Throws if projectDir does not exist or is not a directory.

Examples:
  1. Check naming conventions:
     { "projectDir": "/app/my-project" }
  2. Get results as Markdown for review:
     { "projectDir": "/app/my-project", "responseFormat": "markdown" }`,
      inputSchema: {
        projectDir: z.string().describe("Absolute path to the project root"),
        responseFormat: ResponseFormatField,
        limit: LimitField,
        offset: OffsetField,
      },
      outputSchema: FindingsOutputSchema,
      annotations: {
        readOnlyHint: true,
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: false,
      },
    },
    withErrorHandling(async ({ projectDir, responseFormat, limit, offset }) => {
      const safeDir = await validateProjectDir(projectDir);
      const findings = await checkNamingConventions(safeDir);
      return findingsResponse(findings, responseFormat, { limit, offset });
    }),
  );

  server.registerTool(
    "inspectra_check_file_lengths",
    {
      title: "Check File Lengths",
      description: `Flag source files that exceed configurable line-count thresholds, indicating candidates for decomposition.

Default thresholds: warning at 300 lines, error at 500 lines. Custom thresholds can be set via policy profile.

Args:
  - projectDir (string): Absolute path to the project root.
  - profile (string, optional): Policy profile with custom length thresholds (e.g., "java-angular-playwright").

Returns: Array of Finding objects (domain: "conventions", prefix: CNV-). Each finding reports the file path, line count, and which threshold was exceeded.

Error handling:
  - Throws if projectDir does not exist or is not a directory.`,
      inputSchema: {
        projectDir: z.string().describe("Absolute path to the project root"),
        profile: z.string().optional().describe("Policy profile name (e.g., java-angular-playwright)"),
        responseFormat: ResponseFormatField,
        limit: LimitField,
        offset: OffsetField,
      },
      outputSchema: FindingsOutputSchema,
      annotations: {
        readOnlyHint: true,
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: false,
      },
    },
    withErrorHandling(async ({ projectDir, profile, responseFormat, limit, offset }) => {
      const safeDir = await validateProjectDir(projectDir);
      const profileConfig = profile ? await loadProfile(policiesDir, profile) : undefined;
      const findings = await checkFileLengths(safeDir, profileConfig);
      return findingsResponse(findings, responseFormat, { limit, offset });
    }),
  );

  server.registerTool(
    "inspectra_check_todos",
    {
      title: "Check TODOs",
      description: `Find unresolved TODO, FIXME, HACK, and XXX comments in source files.

Scans all source files for task markers. Each marker is reported as a finding with file path, line number, and surrounding context.

Args:
  - projectDir (string): Absolute path to the project root.
  - profile (string, optional): Policy profile name (currently unused, reserved for future threshold configuration).

Returns: Array of Finding objects (domain: "conventions", prefix: CNV-). Each finding includes the marker type (TODO/FIXME/HACK/XXX), file path, line number, and comment text.

Error handling:
  - Throws if projectDir does not exist or is not a directory.`,
      inputSchema: {
        projectDir: z.string().describe("Absolute path to the project root"),
        profile: z.string().optional().describe("Policy profile name (e.g., java-angular-playwright)"),
        responseFormat: ResponseFormatField,
        limit: LimitField,
        offset: OffsetField,
      },
      outputSchema: FindingsOutputSchema,
      annotations: {
        readOnlyHint: true,
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: false,
      },
    },
    withErrorHandling(async ({ projectDir, responseFormat, limit, offset }) => {
      const safeDir = await validateProjectDir(projectDir);
      const findings = await checkTodoFixmes(safeDir);
      return findingsResponse(findings, responseFormat, { limit, offset });
    }),
  );

  server.registerTool(
    "inspectra_parse_lint_output",
    {
      title: "Parse Lint Output",
      description: `Parse ESLint JSON reports and Checkstyle XML output, converting lint violations into structured findings.

Searches for .eslintrc output and checkstyle-result.xml in standard locations. Can also run ESLint directly if no cached report exists.

Args:
  - projectDir (string): Absolute path to the project root.

Returns: Array of Finding objects (domain: "conventions", prefix: CNV-). Each finding includes the lint rule ID, violation message, file path, and line number.

Error handling:
  - Returns empty findings if no lint output files are found.
  - Throws if projectDir does not exist or is not a directory.`,
      inputSchema: {
        projectDir: z.string().describe("Absolute path to the project root"),
        responseFormat: ResponseFormatField,
        limit: LimitField,
        offset: OffsetField,
      },
      outputSchema: FindingsOutputSchema,
      annotations: {
        readOnlyHint: true,
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: true,
      },
    },
    withErrorHandling(async ({ projectDir, responseFormat, limit, offset }) => {
      const safeDir = await validateProjectDir(projectDir);
      const findings = await parseLintOutput(safeDir);
      return findingsResponse(findings, responseFormat, { limit, offset });
    }),
  );

  server.registerTool(
    "inspectra_detect_dry_violations",
    {
      title: "Detect DRY Violations",
      description: `Detect duplicated code blocks across source files, flagging copy-paste and DRY principle violations.

Compares source file contents using token-based similarity. Flags pairs of files with substantial duplicated logic that should be extracted into shared utilities.

Args:
  - projectDir (string): Absolute path to the project root.

Returns: Array of Finding objects (domain: "conventions", prefix: CNV-). Each finding identifies the two files with duplicated code, the similarity percentage, and a representative snippet.

Error handling:
  - Throws if projectDir does not exist or is not a directory.`,
      inputSchema: {
        projectDir: z.string().describe("Absolute path to the project root"),
        responseFormat: ResponseFormatField,
        limit: LimitField,
        offset: OffsetField,
      },
      outputSchema: FindingsOutputSchema,
      annotations: {
        readOnlyHint: true,
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: false,
      },
    },
    withErrorHandling(async ({ projectDir, responseFormat, limit, offset }) => {
      const safeDir = await validateProjectDir(projectDir);
      const findings = await detectDryViolations(safeDir);
      return findingsResponse(findings, responseFormat, { limit, offset });
    }),
  );
}