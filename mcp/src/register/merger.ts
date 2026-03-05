import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { writeFile, mkdir } from "node:fs/promises";
import { resolve, join } from "node:path";
import { z } from "zod";
import { jsonResponse, reportResponse, errorResponse, withErrorHandling } from "./response.js";
import { ScoreOutputSchema, ResponseFormatField, READ_ONLY_ANNOTATIONS } from "./schemas.js";
import { mergeReports } from "../merger/merge-findings.js";
import { scoreDomain } from "../merger/score.js";
import { loadAllPolicies, loadScoringRules } from "../policies/loader.js";
import { DomainReportSchema, FindingSchema } from "../types.js";
import { setLatestReport } from "./resources.js";
import { ParseError } from "../errors.js";

/**
 * Registers the merger and scoring MCP tools on the given server instance.
 *
 * @param server - The MCP server to register tools on.
 * @param policiesDir - Absolute path to the policies directory.
 */
export function registerMergerTools(server: McpServer, policiesDir: string): void {
  server.registerTool(
    "inspectra_merge_domain_reports",
    {
      title: "Merge Domain Reports",
      description: `Merge multiple domain reports into a single consolidated audit report with scoring and deduplication.

Accepts an array of domain report JSON objects (one per audited domain). Applies deduplication rules to remove redundant findings, computes weighted domain scores, and produces the final consolidated report with an overall grade.

When projectDir is provided, the consolidated report is also saved to <projectDir>/.inspectra/consolidated-report.json — this is the recommended usage to persist audit results alongside the audited code.

Args:
  - domainReportsJson (string): A JSON string containing an array of domain report objects conforming to domain-report.schema.json.
  - target (string): Repository name or path being audited (e.g., "my-org/my-repo").
  - profile (string): Policy profile used for scoring weights (e.g., "java-angular-playwright", "generic").
  - projectDir (string, optional): Absolute path to the root of the audited project. When provided, the consolidated report is written to <projectDir>/.inspectra/consolidated-report.json.

Returns: A consolidated report object containing all domain scores, the overall weighted score, grade (A-F), and the merged findings array.

Error handling:
  - Returns isError: true if domainReportsJson fails Zod validation.

Examples:
  1. Merge with project dir (recommended — persists report to .inspectra/):
     { "domainReportsJson": "[{...security report...}, {...tests report...}]", "target": "my-org/my-repo", "profile": "generic", "projectDir": "/path/to/project" }
  2. Merge without project dir:
     { "domainReportsJson": "[...]", "target": "my-org/backend", "profile": "java-backend" }`,
      inputSchema: {
        domainReportsJson: z.string().describe("JSON string — array of domain report objects"),
        target: z.string().describe("Repository or path being audited"),
        profile: z.string().describe("Policy profile used (e.g., java-angular-playwright)"),
        projectDir: z.string().optional().describe("Absolute path to the audited project root. When provided, the consolidated report is saved to <projectDir>/.inspectra/consolidated-report.json."),
        responseFormat: ResponseFormatField,
      },
      annotations: READ_ONLY_ANNOTATIONS,
    },
    withErrorHandling(async ({ domainReportsJson, target, profile, projectDir, responseFormat }) => {
      let domainReports;
      try {
        domainReports = z.array(DomainReportSchema).parse(JSON.parse(domainReportsJson));
      } catch (err) {
        return errorResponse(
          new ParseError(
            `Invalid domainReportsJson: ${err instanceof Error ? err.message : String(err)}`,
            "Ensure domainReportsJson is a valid JSON array of domain report objects. Each report must have: domain, score, summary, findings[], and metadata. See schemas/domain-report.schema.json.",
          ),
          "inspectra_merge_domain_reports",
        );
      }
      const policies = await loadAllPolicies(policiesDir, profile);
      const consolidated = mergeReports(domainReports, target, profile, policies);
      const reportJson = JSON.stringify(consolidated, null, 2);
      await setLatestReport(reportJson);
      if (projectDir) {
        const inspectraDir = join(resolve(projectDir), ".inspectra");
        await mkdir(inspectraDir, { recursive: true });
        await writeFile(join(inspectraDir, "consolidated-report.json"), reportJson, "utf-8");
      }
      return reportResponse(consolidated, responseFormat);
    }, "inspectra_merge_domain_reports"),
  );

  server.registerTool(
    "inspectra_score_findings",
    {
      title: "Score Findings",
      description: `Compute a domain score (0-100) from a list of findings using the configured scoring rules.

Applies severity-based penalties from scoring-rules.yml. Each finding reduces the score based on its severity and confidence. The result is clamped to the 0-100 range.

Args:
  - findingsJson (string): A JSON string containing an array of finding objects conforming to finding.schema.json.

Returns: An object with a single "score" field (integer, 0-100). A score of 100 means no issues found.

Error handling:
  - Returns isError: true if findingsJson fails Zod validation.

Examples:
  1. Score a set of findings:
     { "findingsJson": "[{\"id\":\"SEC-001\",\"severity\":\"high\",\"domain\":\"security\",\"rule\":\"hardcoded-secret\",\"confidence\":0.95,\"evidence\":[\"src/config.ts\"]}]" }
  2. Score an empty findings list (returns 100):
     { "findingsJson": "[]" }`,
      inputSchema: {
        findingsJson: z.string({ required_error: "findingsJson is required" }).min(1, "findingsJson cannot be empty — provide a JSON array of finding objects").describe("JSON string — array of finding objects"),
      },
      outputSchema: ScoreOutputSchema,
      annotations: READ_ONLY_ANNOTATIONS,
    },
    withErrorHandling(async ({ findingsJson }) => {
      let findings;
      try {
        findings = z.array(FindingSchema).parse(JSON.parse(findingsJson));
      } catch (err) {
        return errorResponse(
          new ParseError(
            `Invalid findingsJson: ${err instanceof Error ? err.message : String(err)}`,
            "Ensure findingsJson is a valid JSON array of finding objects. Each finding must have: id, severity, domain, rule, confidence, and evidence[]. See schemas/finding.schema.json.",
          ),
          "inspectra_score_findings",
        );
      }
      const scoring = await loadScoringRules(policiesDir);
      const score = scoreDomain(findings, scoring);
      return jsonResponse({ score });
    }, "inspectra_score_findings"),
  );
}