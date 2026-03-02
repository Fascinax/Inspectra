import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { parseCoverage, parseTestResults, detectMissingTests, parsePlaywrightReport, detectFlakyTests } from "../tools/tests.js";
import { loadProfile } from "../policies/loader.js";
import { validateProjectDir } from "../utils/paths.js";

/**
 * Registers all tests-domain MCP tools on the given server instance.
 *
 * @param server - The MCP server to register tools on.
 * @param policiesDir - Absolute path to the policies directory.
 */
export function registerTestsTools(server: McpServer, policiesDir: string): void {
  server.tool(
    "parse-coverage",
    "Parse coverage reports and flag metrics below thresholds",
    {
      projectDir: z.string().describe("Absolute path to the project root"),
      profile: z.string().optional().describe("Policy profile name (e.g., java-angular-playwright)"),
    },
    async ({ projectDir, profile }) => {
      const safeDir = await validateProjectDir(projectDir);
      const profileConfig = profile ? await loadProfile(policiesDir, profile) : undefined;
      const findings = await parseCoverage(safeDir, profileConfig);
      return { content: [{ type: "text", text: JSON.stringify(findings, null, 2) }] };
    },
  );

  server.tool(
    "parse-test-results",
    "Parse JUnit XML test results and report failures",
    { projectDir: z.string().describe("Absolute path to the project root") },
    async ({ projectDir }) => {
      const safeDir = await validateProjectDir(projectDir);
      const findings = await parseTestResults(safeDir);
      return { content: [{ type: "text", text: JSON.stringify(findings, null, 2) }] };
    },
  );

  server.tool(
    "detect-missing-tests",
    "Detect source files that lack a corresponding test file",
    { projectDir: z.string().describe("Absolute path to the project root") },
    async ({ projectDir }) => {
      const safeDir = await validateProjectDir(projectDir);
      const findings = await detectMissingTests(safeDir);
      return { content: [{ type: "text", text: JSON.stringify(findings, null, 2) }] };
    },
  );

  server.tool(
    "parse-playwright-report",
    "Parse Playwright JSON test reports and report failures",
    { projectDir: z.string().describe("Absolute path to the project root") },
    async ({ projectDir }) => {
      const safeDir = await validateProjectDir(projectDir);
      const findings = await parsePlaywrightReport(safeDir);
      return { content: [{ type: "text", text: JSON.stringify(findings, null, 2) }] };
    },
  );

  server.tool(
    "detect-flaky-tests",
    "Detect flaky tests from JUnit XML rerun markers or Playwright retry results",
    { projectDir: z.string().describe("Absolute path to the project root") },
    async ({ projectDir }) => {
      const safeDir = await validateProjectDir(projectDir);
      const findings = await detectFlakyTests(safeDir);
      return { content: [{ type: "text", text: JSON.stringify(findings, null, 2) }] };
    },
  );
}
