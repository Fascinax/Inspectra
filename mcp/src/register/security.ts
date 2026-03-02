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
  server.tool(
    "scan-secrets",
    "Scan source files for hardcoded secrets, API keys, and credentials",
    {
      filePathsCsv: z.string().describe("Comma-separated absolute paths to files to scan"),
      profile: z.string().optional().describe("Policy profile name (e.g., java-angular-playwright)"),
    },
    async ({ filePathsCsv, profile }) => {
      const filePaths = await validateFilePathsCsv(filePathsCsv);
      const profileConfig = profile ? await loadProfile(policiesDir, profile) : undefined;
      const findings = await scanSecrets(filePaths, profileConfig?.security?.additional_patterns);
      return jsonResponse(findings);
    },
  );

  server.tool(
    "check-deps-vulns",
    "Run npm audit to find vulnerable dependencies",
    { projectDir: z.string().describe("Absolute path to the project root") },
    async ({ projectDir }) => {
      const safeDir = await validateProjectDir(projectDir);
      const findings = await checkDependencyVulnerabilities(safeDir);
      return jsonResponse(findings);
    },
  );

  server.tool(
    "run-semgrep",
    "Run Semgrep static analysis to detect deep security and code quality patterns",
    { projectDir: z.string().describe("Absolute path to the project root") },
    async ({ projectDir }) => {
      const safeDir = await validateProjectDir(projectDir);
      const findings = await runSemgrep(safeDir);
      return jsonResponse(findings);
    },
  );

  server.tool(
    "check-maven-deps",
    "Analyze Maven pom.xml for dependency count, SNAPSHOT versions, and outdated libraries",
    { projectDir: z.string().describe("Absolute path to the project root") },
    async ({ projectDir }) => {
      const safeDir = await validateProjectDir(projectDir);
      const findings = await checkMavenDependencies(safeDir);
      return jsonResponse(findings);
    },
  );
}
