import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { jsonResponse, withErrorHandling } from "./response.js";
import { FindingsOutputSchema } from "./schemas.js";
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
      description: `Parse code coverage reports and flag metrics below configured thresholds.

Looks for coverage-summary.json and lcov.info files in standard locations (coverage/, reports/). Compares line, branch, and function coverage against profile thresholds.

Args:
  - projectDir (string): Absolute path to the project root.
  - profile (string, optional): Policy profile with custom coverage thresholds (e.g., "java-angular-playwright").

Returns: Array of Finding objects (domain: "tests", prefix: TST-). Findings include the coverage metric name, actual percentage, required threshold, and delta.

Error handling:
  - Returns empty findings if no coverage report is found.
  - Throws if projectDir does not exist or is not a directory.`,
      inputSchema: {
        projectDir: z.string().describe("Absolute path to the project root"),
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
    withErrorHandling(async ({ projectDir, profile }) => {
      const safeDir = await validateProjectDir(projectDir);
      const profileConfig = profile ? await loadProfile(policiesDir, profile) : undefined;
      const findings = await parseCoverage(safeDir, profileConfig);
      return jsonResponse(findings);
    }),
  );

  server.registerTool(
    "inspectra_parse_test_results",
    {
      title: "Parse Test Results",
      description: `Parse JUnit XML test result files and report test failures and errors.

Searches for JUnit XML files in standard locations (test-results/, reports/, surefire-reports/).

Args:
  - projectDir (string): Absolute path to the project root.

Returns: Array of Finding objects (domain: "tests", prefix: TST-). Each finding includes the failed test name, class, failure message, and stack trace snippet.

Error handling:
  - Returns empty findings if no JUnit XML files are found.
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
      const findings = await parseTestResults(safeDir);
      return jsonResponse(findings);
    }),
  );

  server.registerTool(
    "inspectra_detect_missing_tests",
    {
      title: "Detect Missing Tests",
      description: `Detect source files that lack a corresponding test file.

Scans for .ts, .js, and .java source files and checks whether a matching .test.* or .spec.* file exists. Excludes test files, config files, and index re-exports from analysis.

Args:
  - projectDir (string): Absolute path to the project root.

Returns: Array of Finding objects (domain: "tests", prefix: TST-). Each finding identifies the untested source file and recommends creating the missing test.

Error handling:
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
      const findings = await detectMissingTests(safeDir);
      return jsonResponse(findings);
    }),
  );

  server.registerTool(
    "inspectra_parse_playwright_report",
    {
      title: "Parse Playwright Report",
      description: `Parse Playwright JSON test reports and report test failures.

Searches for playwright-report.json and test-results.json files in standard locations.

Args:
  - projectDir (string): Absolute path to the project root.

Returns: Array of Finding objects (domain: "tests", prefix: TST-). Each finding includes the failed test title, browser, error message, and screenshot path if available.

Error handling:
  - Returns empty findings if no Playwright report is found.
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
      const findings = await parsePlaywrightReport(safeDir);
      return jsonResponse(findings);
    }),
  );

  server.registerTool(
    "inspectra_detect_flaky_tests",
    {
      title: "Detect Flaky Tests",
      description: `Detect flaky tests by analyzing retry patterns in JUnit XML rerun markers and Playwright retry results.

Identifies tests that passed after retries, indicating intermittent failures. Flaky tests erode confidence in CI pipelines.

Args:
  - projectDir (string): Absolute path to the project root.

Returns: Array of Finding objects (domain: "tests", prefix: TST-). Each finding identifies the flaky test, retry count, and the test framework source.

Error handling:
  - Returns empty findings if no test reports with retry data are found.
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
      const findings = await detectFlakyTests(safeDir);
      return jsonResponse(findings);
    }),
  );
}