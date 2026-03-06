import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { findingsResponse, withErrorHandling } from "./response.js";
import { STANDARD_INPUT_SCHEMA, PROFILED_INPUT_SCHEMA, FINDINGS_TOOL_META, READ_ONLY_OPEN_WORLD_ANNOTATIONS, FindingsOutputSchema } from "./schemas.js";
import {
  checkNamingConventions,
  checkFileLengths,
  checkTodoFixmes,
  parseLintOutput,
  detectDryViolations,
  checkFunctionLengths,
  checkParamCounts,
  checkMagicNumbers,
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
      inputSchema: PROFILED_INPUT_SCHEMA,
      ...FINDINGS_TOOL_META,
    },
    withErrorHandling(async ({ projectDir, profile, responseFormat, limit, offset }) => {
      const safeDir = await validateProjectDir(projectDir);
      const profileConfig = profile ? await loadProfile(policiesDir, profile) : undefined;
      const findings = await checkNamingConventions(safeDir, profileConfig);
      return findingsResponse(findings, responseFormat, { limit, offset });
    }, "inspectra_check_naming"),
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
  - Throws if projectDir does not exist or is not a directory.

Examples:
  1. Check with default thresholds:
     { "projectDir": "/app/my-project" }
  2. Check with custom profile thresholds:
     { "projectDir": "/app/my-project", "profile": "java-backend" }`,
      inputSchema: PROFILED_INPUT_SCHEMA,
      ...FINDINGS_TOOL_META,
    },
    withErrorHandling(async ({ projectDir, profile, responseFormat, limit, offset }) => {
      const safeDir = await validateProjectDir(projectDir);
      const profileConfig = profile ? await loadProfile(policiesDir, profile) : undefined;
      const findings = await checkFileLengths(safeDir, profileConfig);
      return findingsResponse(findings, responseFormat, { limit, offset });
    }, "inspectra_check_file_lengths"),
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
  - Throws if projectDir does not exist or is not a directory.

Examples:
  1. Scan for TODO/FIXME markers:
     { "projectDir": "/app/my-project" }
  2. Get TODO markers in Markdown format:
     { "projectDir": "/app/my-project", "responseFormat": "markdown" }`,
      inputSchema: PROFILED_INPUT_SCHEMA,
      ...FINDINGS_TOOL_META,
    },
    withErrorHandling(async ({ projectDir, responseFormat, limit, offset }) => {
      const safeDir = await validateProjectDir(projectDir);
      const findings = await checkTodoFixmes(safeDir);
      return findingsResponse(findings, responseFormat, { limit, offset });
    }, "inspectra_check_todos"),
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
  - Throws if projectDir does not exist or is not a directory.

Examples:
  1. Parse lint reports from a project:
     { "projectDir": "/app/my-project" }
  2. Get lint results paginated:
     { "projectDir": "/app/my-project", "limit": 10, "offset": 0 }`,
      inputSchema: STANDARD_INPUT_SCHEMA,
      outputSchema: FindingsOutputSchema,
      annotations: READ_ONLY_OPEN_WORLD_ANNOTATIONS,
    },
    withErrorHandling(async ({ projectDir, responseFormat, limit, offset }) => {
      const safeDir = await validateProjectDir(projectDir);
      const findings = await parseLintOutput(safeDir);
      return findingsResponse(findings, responseFormat, { limit, offset });
    }, "inspectra_parse_lint_output"),
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
  - Throws if projectDir does not exist or is not a directory.

Examples:
  1. Detect duplicated code blocks:
     { "projectDir": "/app/my-project" }
  2. Get DRY violations as Markdown:
     { "projectDir": "/app/my-project", "responseFormat": "markdown" }`,
      inputSchema: STANDARD_INPUT_SCHEMA,
      ...FINDINGS_TOOL_META,
    },
    withErrorHandling(async ({ projectDir, responseFormat, limit, offset }) => {
      const safeDir = await validateProjectDir(projectDir);
      const findings = await detectDryViolations(safeDir);
      return findingsResponse(findings, responseFormat, { limit, offset });
    }, "inspectra_detect_dry_violations"),
  );

  server.registerTool(
    "inspectra_check_function_lengths",
    {
      title: "Check Function Lengths",
      description: `Flag functions and methods that exceed configurable line-count thresholds.

Parses source files to detect function/method boundaries and reports those exceeding the warning threshold (default 30 lines) or error threshold (default 60 lines). Supports TypeScript, JavaScript, Java, Python, Go, and Kotlin.

Maps to Clean Code rules F1, G30, G34 (functions should be small, do one thing, stay at one abstraction level).

Args:
  - projectDir (string): Absolute path to the project root.
  - profile (string, optional): Policy profile with custom thresholds (function_lengths_warning, function_lengths_error).

Returns: Array of Finding objects (domain: "conventions", prefix: CNV-, IDs 300+). Each finding reports the function name, line count, and start line.

Error handling:
  - Throws if projectDir does not exist or is not a directory.
  - Skips files that cannot be read.

Examples:
  1. Check with default thresholds (30/60 lines):
     { "projectDir": "/app/my-project" }
  2. Check with custom profile:
     { "projectDir": "/app/my-project", "profile": "java-backend" }`,
      inputSchema: PROFILED_INPUT_SCHEMA,
      ...FINDINGS_TOOL_META,
    },
    withErrorHandling(async ({ projectDir, profile, responseFormat, limit, offset }) => {
      const safeDir = await validateProjectDir(projectDir);
      const profileConfig = profile ? await loadProfile(policiesDir, profile) : undefined;
      const findings = await checkFunctionLengths(safeDir, profileConfig);
      return findingsResponse(findings, responseFormat, { limit, offset });
    }, "inspectra_check_function_lengths"),
  );

  server.registerTool(
    "inspectra_check_param_counts",
    {
      title: "Check Parameter Counts",
      description: `Flag functions and methods with too many parameters.

Detects functions exceeding the warning threshold (default 3 params) or error threshold (default 5 params). Supports TypeScript, JavaScript, Java, Python, Go, and Kotlin.

Maps to Clean Code rule F1 (Too Many Arguments). Functions with many parameters are harder to test, understand, and maintain.

Args:
  - projectDir (string): Absolute path to the project root.
  - profile (string, optional): Policy profile with custom thresholds (param_count_warning, param_count_error).

Returns: Array of Finding objects (domain: "conventions", prefix: CNV-, IDs 350+). Each finding reports the function name, parameter count, and the parameter list.

Error handling:
  - Throws if projectDir does not exist or is not a directory.
  - Skips files that cannot be read.

Examples:
  1. Check with default thresholds (3/5 params):
     { "projectDir": "/app/my-project" }
  2. Check with custom profile:
     { "projectDir": "/app/my-project", "profile": "typescript-node" }`,
      inputSchema: PROFILED_INPUT_SCHEMA,
      ...FINDINGS_TOOL_META,
    },
    withErrorHandling(async ({ projectDir, profile, responseFormat, limit, offset }) => {
      const safeDir = await validateProjectDir(projectDir);
      const profileConfig = profile ? await loadProfile(policiesDir, profile) : undefined;
      const findings = await checkParamCounts(safeDir, profileConfig);
      return findingsResponse(findings, responseFormat, { limit, offset });
    }, "inspectra_check_param_counts"),
  );

  server.registerTool(
    "inspectra_check_magic_numbers",
    {
      title: "Check Magic Numbers",
      description: `Detect unnamed numeric constants (magic numbers) in source files.

Scans source code for numeric literals that are not assigned to named constants. Excludes common safe values (0, 1, -1, 100), constant declarations, import lines, and test assertions.

Maps to Clean Code rule G25 (Replace Magic Numbers with Named Constants).

Args:
  - projectDir (string): Absolute path to the project root.

Returns: Array of Finding objects (domain: "conventions", prefix: CNV-, IDs 400+). Each finding reports the numeric value, file path, line number, and surrounding code snippet. Limited to 5 findings per file to avoid noise.

Error handling:
  - Throws if projectDir does not exist or is not a directory.
  - Skips files that cannot be read.

Examples:
  1. Detect magic numbers:
     { "projectDir": "/app/my-project" }
  2. Get results as Markdown:
     { "projectDir": "/app/my-project", "responseFormat": "markdown" }`,
      inputSchema: STANDARD_INPUT_SCHEMA,
      ...FINDINGS_TOOL_META,
    },
    withErrorHandling(async ({ projectDir, responseFormat, limit, offset }) => {
      const safeDir = await validateProjectDir(projectDir);
      const findings = await checkMagicNumbers(safeDir);
      return findingsResponse(findings, responseFormat, { limit, offset });
    }, "inspectra_check_magic_numbers"),
  );
}