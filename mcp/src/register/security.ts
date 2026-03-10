import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { findingsResponse, withErrorHandling } from "./response.js";
import { STANDARD_INPUT_SCHEMA, FINDINGS_TOOL_META, FINDINGS_OPEN_WORLD_META, ProfileField, ResponseFormatField, LimitField, OffsetField, ProjectDirField } from "./schemas.js";
import { scanSecrets, scanSecretsInDir, checkDependencyVulnerabilities, runSemgrep, checkMavenDependencies, checkSecurityConfig } from "../tools/security.js";
import { loadProfile } from "../policies/loader.js";
import { validateProjectDir, validateFilePathsCsv } from "../utils/paths.js";

/**
 * Registers all security-domain MCP tools on the given server instance.
 *
 * @param server - The MCP server to register tools on.
 * @param policiesDir - Absolute path to the policies directory.
 */
export function registerSecurityTools(server: McpServer, policiesDir: string): void {
  server.registerTool(
    "inspectra_scan_secrets",
    {
      title: "Scan Secrets",
      description: `Scan source files for hardcoded secrets, API keys, tokens, private keys, and credentials using regex pattern matching.

Detects: hardcoded passwords, API keys, private RSA/EC/DSA keys, JWTs, connection strings (JDBC, MongoDB, PostgreSQL, MySQL, Redis), and custom patterns from the selected profile.

Args:
  - projectDir (string, recommended): Absolute path to the project root. Scans all source files (.ts/.js/.java/.py/.go/.yaml/.json/.env etc.) automatically.
  - filePathsCsv (string, alternative): Comma-separated absolute file paths to scan explicitly. Use when you only want to scan specific files.
  - profile (string, optional): Policy profile name for additional secret patterns (e.g., "java-angular-playwright").

Note: Provide either projectDir or filePathsCsv — if both are given, projectDir takes precedence.

Returns: Array of Finding objects (domain: "security", prefix: SEC-). Each finding includes the file path, line number, a redacted snippet, and the matched rule.

Error handling:
  - Throws if neither projectDir nor filePathsCsv is provided.
  - Throws if filePathsCsv paths contain shell metacharacters.

Examples:
  1. Scan entire project (recommended):
     { "projectDir": "/app/my-project" }
  2. Scan specific files:
     { "filePathsCsv": "/app/src/config.ts,/app/src/auth.ts" }
  3. Scan with a Java-specific profile:
     { "projectDir": "/app/my-project", "profile": "java-backend" }
  4. Paginate results (first 10):
     { "projectDir": "/app/my-project", "limit": 10, "offset": 0 }`,
      inputSchema: {
        projectDir: ProjectDirField.optional().describe("Absolute path to the project root. Recommended: scans all source files automatically"),
        filePathsCsv: z.string().min(1).optional().describe("Comma-separated absolute paths to specific files to scan (alternative to projectDir)"),
        profile: ProfileField,
        responseFormat: ResponseFormatField,
        limit: LimitField,
        offset: OffsetField,
      },
      ...FINDINGS_TOOL_META,
    },
    withErrorHandling(async ({ projectDir, filePathsCsv, profile, responseFormat, limit, offset }) => {
      const profileConfig = profile ? await loadProfile(policiesDir, profile) : undefined;
      let findings;
      if (projectDir) {
        const safeDir = await validateProjectDir(projectDir);
        findings = await scanSecretsInDir(safeDir, profileConfig?.security?.additional_patterns);
      } else if (filePathsCsv) {
        const filePaths = await validateFilePathsCsv(filePathsCsv);
        findings = await scanSecrets(filePaths, profileConfig?.security?.additional_patterns);
      } else {
        throw new Error("Either projectDir or filePathsCsv must be provided");
      }
      return findingsResponse(findings, responseFormat, { limit, offset });
    }, "inspectra_scan_secrets"),
  );

  server.registerTool(
    "inspectra_check_deps_vulns",
    {
      title: "Check Dependency Vulnerabilities",
      description: `Run npm audit on the target project to detect known vulnerabilities in dependencies.

Executes npm audit --json and parses the output. Requires package-lock.json to be present.

Args:
  - projectDir (string): Absolute path to the project root containing package.json and package-lock.json.

Returns: Array of Finding objects (domain: "security", prefix: SEC-). Each finding includes the vulnerable package name, advisory URL, severity, and recommended fix version.

Error handling:
  - Throws if projectDir does not exist or is not a directory.
  - Returns empty findings if no package-lock.json is found.
  - Gracefully handles npm audit failures (e.g., npm not installed).

Examples:
  1. Audit a Node.js project:
     { "projectDir": "/app/my-project" }
  2. Get results as Markdown:
     { "projectDir": "/app/my-project", "responseFormat": "markdown" }`,
      inputSchema: STANDARD_INPUT_SCHEMA,
      ...FINDINGS_OPEN_WORLD_META,
    },
    withErrorHandling(async ({ projectDir, responseFormat, limit, offset }) => {
      const safeDir = await validateProjectDir(projectDir);
      const findings = await checkDependencyVulnerabilities(safeDir);
      return findingsResponse(findings, responseFormat, { limit, offset });
    }, "inspectra_check_deps_vulns"),
  );

  server.registerTool(
    "inspectra_run_semgrep",
    {
      title: "Run Semgrep",
      description: `Run Semgrep static analysis to detect deep security and code quality patterns beyond simple regex matching.

Executes semgrep --json --config auto on the project. Requires Semgrep to be installed and available in PATH.

Args:
  - projectDir (string): Absolute path to the project root.

Returns: Array of Finding objects (domain: "security", prefix: SEC-). Each finding includes the Semgrep rule ID, matched code pattern, severity mapping, and file location.

Error handling:
  - Returns empty findings if Semgrep is not installed.
  - Times out after 30 seconds to avoid hanging on large codebases.

Examples:
  1. Run Semgrep on a project:
     { "projectDir": "/app/my-project" }
  2. Paginate results (first 10):
     { "projectDir": "/app/my-project", "limit": 10, "offset": 0 }`,
      inputSchema: STANDARD_INPUT_SCHEMA,
      ...FINDINGS_OPEN_WORLD_META,
    },
    withErrorHandling(async ({ projectDir, responseFormat, limit, offset }) => {
      const safeDir = await validateProjectDir(projectDir);
      const findings = await runSemgrep(safeDir);
      return findingsResponse(findings, responseFormat, { limit, offset });
    }, "inspectra_run_semgrep"),
  );

  server.registerTool(
    "inspectra_check_maven_deps",
    {
      title: "Check Maven Dependencies",
      description: `Analyze Maven pom.xml for dependency health: excessive dependency count, SNAPSHOT versions, and potential outdated libraries.

Parses the pom.xml file directly (does not require Maven to be installed).

Args:
  - projectDir (string): Absolute path to the project root containing pom.xml.

Returns: Array of Finding objects (domain: "security", prefix: SEC-). Findings cover excessive dependency count, SNAPSHOT versions, and missing dependency management.

Error handling:
  - Returns empty findings if no pom.xml is found.
  - Throws if projectDir does not exist or is not a directory.

Examples:
  1. Analyze a Maven project:
     { "projectDir": "/app/java-backend" }
  2. Check a Spring Boot project with Markdown output:
     { "projectDir": "/app/spring-app", "responseFormat": "markdown" }`,
      inputSchema: STANDARD_INPUT_SCHEMA,
      ...FINDINGS_TOOL_META,
    },
    withErrorHandling(async ({ projectDir, responseFormat, limit, offset }) => {
      const safeDir = await validateProjectDir(projectDir);
      const findings = await checkMavenDependencies(safeDir);
      return findingsResponse(findings, responseFormat, { limit, offset });
    }, "inspectra_check_maven_deps"),
  );

  server.registerTool(
    "inspectra_check_security_config",
    {
      title: "Check Security Configuration",
      description: `Scan source files for framework-level security misconfigurations.

Detects: Spring Security permitAll()/csrf().disable(), commented-out @PreAuthorize/@Secured/@RolesAllowed annotations, CORS wildcard origins with credentials, missing @Valid on @RequestBody, and exposed Actuator endpoints.

Args:
  - projectDir (string): Absolute path to the project root.

Returns: Array of Finding objects (domain: "security", prefix: SEC-). Each finding includes the file path, line number, matched rule, and OWASP/CWE tags.

Examples:
  1. Scan a Spring Boot project:
     { "projectDir": "/app/spring-project" }
  2. Paginate results:
     { "projectDir": "/app/spring-project", "limit": 10, "offset": 0 }`,
      inputSchema: STANDARD_INPUT_SCHEMA,
      ...FINDINGS_TOOL_META,
    },
    withErrorHandling(async ({ projectDir, responseFormat, limit, offset }) => {
      const safeDir = await validateProjectDir(projectDir);
      const findings = await checkSecurityConfig(safeDir);
      return findingsResponse(findings, responseFormat, { limit, offset });
    }, "inspectra_check_security_config"),
  );
}