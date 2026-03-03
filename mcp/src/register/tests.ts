import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { jsonResponse } from "./response.js";
import {
  parseCoverage,
  parseTestResults,
  detectMissingTests,
  parsePlaywrightReport,
  detectFlakyTests,
} from "../tools/tests.js";
import { loadProfile } from "../policies/loader.js";
import { validateProjectDir } from "../utils/paths.js";

/**
 * Registers all tests-domain MCP tools on the given server instance.
 *
 * @param server - The MCP server to register tools on.
 * @param policiesDir - Absolute path to the policies directory.
 */
export function registerTestsTools(server: McpServer, policiesDir: string): void {
  server.registerTool(
    "inspectra_parse_coverage",
    {
      title: "Parse Coverage",
      description: "Parse coverage reports and flag metrics below thresholds",
      inputSchema: {
        projectDir: z.string().describe("Absolute path to the project root"),
        profile: z.string().optional().describe("Policy profile name (e.g., java-angular-playwright)"),
      },
      annotations: {
        readOnlyHint: true,
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: false,
      },
    },
    async ({ projectDir, profile }) => {
      const safeDir = await validateProjectDir(projectDir);
      const profileConfig = profile ? await loadProfile(policiesDir, profile) : undefined;
      const findings = await parseCoverage(safeDir, profileConfig);
      return jsonResponse(findings);
    },
  );

  server.registerTool(
    "inspectra_parse_test_results",
    {
      title: "Parse Test Results",
      description: "Parse JUnit XML test results and report failures",
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
      const findings = await parseTestResults(safeDir);
      return jsonResponse(findings);
    },
  );

  server.registerTool(
    "inspectra_detect_missing_tests",
    {
      title: "Detect Missing Tests",
      description: "Detect source files that lack a corresponding test file",
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
      const findings = await detectMissingTests(safeDir);
      return jsonResponse(findings);
    },
  );

  server.registerTool(
    "inspectra_parse_playwright_report",
    {
      title: "Parse Playwright Report",
      description: "Parse Playwright JSON test reports and report failures",
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
      const findings = await parsePlaywrightReport(safeDir);
      return jsonResponse(findings);
    },
  );

  server.registerTool(
    "inspectra_detect_flaky_tests",
    {
      title: "Detect Flaky Tests",
      description: "Detect flaky tests from JUnit XML rerun markers or Playwright retry results",
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
      const findings = await detectFlakyTests(safeDir);
      return jsonResponse(findings);
    },
  );
}
