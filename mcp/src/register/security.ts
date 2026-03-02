import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { jsonResponse } from "./response.js";
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
    "scan-secrets",
    {
      title: "Scan Secrets",
      description: "Scan source files for hardcoded secrets, API keys, and credentials",
      inputSchema: {
        filePathsCsv: z.string().describe("Comma-separated absolute paths to files to scan"),
        profile: z.string().optional().describe("Policy profile name (e.g., java-angular-playwright)"),
      },
      annotations: {
        readOnlyHint: true,
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: false,
      },
    },
    async ({ filePathsCsv, profile }) => {
      const filePaths = await validateFilePathsCsv(filePathsCsv);
      const profileConfig = profile ? await loadProfile(policiesDir, profile) : undefined;
      const findings = await scanSecrets(filePaths, profileConfig?.security?.additional_patterns);
      return jsonResponse(findings);
    },
  );

  server.registerTool(
    "check-deps-vulns",
    {
      title: "Check Dependency Vulnerabilities",
      description: "Run npm audit to find vulnerable dependencies",
      inputSchema: {
        projectDir: z.string().describe("Absolute path to the project root"),
      },
      annotations: {
        readOnlyHint: true,
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: true,
      },
    },
    async ({ projectDir }) => {
      const safeDir = await validateProjectDir(projectDir);
      const findings = await checkDependencyVulnerabilities(safeDir);
      return jsonResponse(findings);
    },
  );

  server.registerTool(
    "run-semgrep",
    {
      title: "Run Semgrep",
      description: "Run Semgrep static analysis to detect deep security and code quality patterns",
      inputSchema: {
        projectDir: z.string().describe("Absolute path to the project root"),
      },
      annotations: {
        readOnlyHint: true,
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: true,
      },
    },
    async ({ projectDir }) => {
      const safeDir = await validateProjectDir(projectDir);
      const findings = await runSemgrep(safeDir);
      return jsonResponse(findings);
    },
  );

  server.registerTool(
    "check-maven-deps",
    {
      title: "Check Maven Dependencies",
      description: "Analyze Maven pom.xml for dependency count, SNAPSHOT versions, and outdated libraries",
      inputSchema: {
        projectDir: z.string().describe("Absolute path to the project root"),
      },
      annotations: {
        readOnlyHint: true,
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: false,
      },
    },
    async ({ projectDir }) => {
      const safeDir = await validateProjectDir(projectDir);
      const findings = await checkMavenDependencies(safeDir);
      return jsonResponse(findings);
    },
  );
}
