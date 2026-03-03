import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { jsonResponse, withErrorHandling } from "./response.js";
import { FindingsOutputSchema } from "./schemas.js";
import { scanSecrets, checkDependencyVulnerabilities, runSemgrep, checkMavenDependencies } from "../tools/security.js";
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
  - filePathsCsv (string): Comma-separated absolute file paths to scan. Each path must exist and be a regular file.
  - profile (string, optional): Policy profile name for additional secret patterns (e.g., "java-angular-playwright").

Returns: Array of Finding objects (domain: "security", prefix: SEC-). Each finding includes the file path, line number, a redacted snippet, and the matched rule.

Error handling:
  - Throws if any file path is invalid, non-existent, or a directory.
  - Throws if paths contain shell metacharacters.`,
      inputSchema: {
        filePathsCsv: z.string().describe("Comma-separated absolute paths to files to scan"),
        profile: z.string().optional().describe("Policy profile name (e.g., java-angular-playwright)"),
      },
      outputSchema: FindingsOutputSchema,
      annotations: {
        readOnlyHint: true,
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: false,
      },
    },
    withErrorHandling(async ({ filePathsCsv, profile }) => {
      const filePaths = await validateFilePathsCsv(filePathsCsv);
      const profileConfig = profile ? await loadProfile(policiesDir, profile) : undefined;
      const findings = await scanSecrets(filePaths, profileConfig?.security?.additional_patterns);
      return jsonResponse(findings);
    }),
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
  - Gracefully handles npm audit failures (e.g., npm not installed).`,
      inputSchema: {
        projectDir: z.string().describe("Absolute path to the project root"),
      },
      outputSchema: FindingsOutputSchema,
      annotations: {
        readOnlyHint: true,
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: true,
      },
    },
    withErrorHandling(async ({ projectDir }) => {
      const safeDir = await validateProjectDir(projectDir);
      const findings = await checkDependencyVulnerabilities(safeDir);
      return jsonResponse(findings);
    }),
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
  - Times out after 30 seconds to avoid hanging on large codebases.`,
      inputSchema: {
        projectDir: z.string().describe("Absolute path to the project root"),
      },
      outputSchema: FindingsOutputSchema,
      annotations: {
        readOnlyHint: true,
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: true,
      },
    },
    withErrorHandling(async ({ projectDir }) => {
      const safeDir = await validateProjectDir(projectDir);
      const findings = await runSemgrep(safeDir);
      return jsonResponse(findings);
    }),
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
  - Throws if projectDir does not exist or is not a directory.`,
      inputSchema: {
        projectDir: z.string().describe("Absolute path to the project root"),
      },
      outputSchema: FindingsOutputSchema,
      annotations: {
        readOnlyHint: true,
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: false,
      },
    },
    withErrorHandling(async ({ projectDir }) => {
      const safeDir = await validateProjectDir(projectDir);
      const findings = await checkMavenDependencies(safeDir);
      return jsonResponse(findings);
    }),
  );
}