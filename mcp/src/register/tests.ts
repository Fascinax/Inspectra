import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { findingsResponse, withErrorHandling } from "./response.js";
import { FindingsOutputSchema, READ_ONLY_ANNOTATIONS, ResponseFormatField, LimitField, OffsetField, ProjectDirField, ProfileField } from "./schemas.js";
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
  - Throws if projectDir does not exist or is not a directory.

Examples:
  1. Parse coverage for a Node.js project:
     { "projectDir": "/app/my-project" }
  2. Parse with custom thresholds from a profile:
     { "projectDir": "/app/my-project", "profile": "java-angular-playwright" }
  3. Get results as Markdown:
     { "projectDir": "/app/my-project", "responseFormat": "markdown" }`,
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
      const findings = await parseCoverage(safeDir, profileConfig);
      return findingsResponse(findings, responseFormat, { limit, offset });
    }, "inspectra_parse_coverage"),
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
  - Throws if projectDir does not exist or is not a directory.

Examples:
  1. Parse test results after a Maven build:
     { "projectDir": "/app/java-backend" }
  2. Get failures as Markdown:
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
      const findings = await parseTestResults(safeDir);
      return findingsResponse(findings, responseFormat, { limit, offset });
    }, "inspectra_parse_test_results"),
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
  - Throws if projectDir does not exist or is not a directory.

Examples:
  1. Detect missing tests:
     { "projectDir": "/app/my-project" }
  2. Paginate for large projects (first 20):
     { "projectDir": "/app/big-monorepo", "limit": 20 }`,
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
      const findings = await detectMissingTests(safeDir);
      return findingsResponse(findings, responseFormat, { limit, offset });
    }, "inspectra_detect_missing_tests"),
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
  - Throws if projectDir does not exist or is not a directory.

Examples:
  1. Parse Playwright report:
     { "projectDir": "/app/e2e-tests" }
  2. Get first 5 failures:
     { "projectDir": "/app/e2e-tests", "limit": 5 }`,
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
      const findings = await parsePlaywrightReport(safeDir);
      return findingsResponse(findings, responseFormat, { limit, offset });
    }, "inspectra_parse_playwright_report"),
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
  - Throws if projectDir does not exist or is not a directory.

Examples:
  1. Detect flaky tests:
     { "projectDir": "/app/my-project" }
  2. Get Markdown report for CI review:
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
      const findings = await detectFlakyTests(safeDir);
      return findingsResponse(findings, responseFormat, { limit, offset });
    }, "inspectra_detect_flaky_tests"),
  );
}