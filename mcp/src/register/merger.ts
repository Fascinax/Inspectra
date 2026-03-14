import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { writeFile, mkdir } from "node:fs/promises";
import { resolve, join } from "node:path";
import { z } from "zod";
import { jsonResponse, reportResponse, errorResponse, withErrorHandling } from "./response.js";
import { ScoreOutputSchema, ResponseFormatField, READ_ONLY_ANNOTATIONS } from "./schemas.js";
import { mergeReports } from "../merger/merge-findings.js";
import { scoreDomain } from "../merger/score.js";
import { loadAllPolicies, loadScoringRules, loadRootCausePatterns } from "../policies/loader.js";
import { DomainReportSchema, FindingSchema, DOMAINS, SEVERITY_LEVELS } from "../types.js";
import { setLatestReport } from "./resources.js";
import { ParseError } from "../errors.js";
import { loadIgnoreRules } from "../utils/ignore.js";
import { detectHotspots } from "../merger/correlate.js";
import { inferRootCauseClusters } from "../merger/root-cause.js";

const HotspotInputSchema = z.object({
  type: z.enum(["file", "module", "dependency", "pattern"]),
  key: z.string().min(1),
  label: z.string().min(1),
  finding_count: z.number().int().nonnegative(),
  domain_count: z.number().int().nonnegative(),
  domains: z.array(z.enum(DOMAINS)),
  severity_ceiling: z.enum(SEVERITY_LEVELS),
  findings: z.array(FindingSchema),
});

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
      if (projectDir) {
        policies.ignoreRules = await loadIgnoreRules(resolve(projectDir));
      }
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

  server.registerTool(
    "inspectra_correlate_findings",
    {
      title: "Correlate Findings into Hotspots",
      description: `Analyze a flat list of findings and group them into actionable hotspots.

Four hotspot types are detected:
  - **file**: a single file accumulates 3+ findings from 2+ different domains
  - **module**: a directory accumulates 5+ findings across 2+ files
  - **dependency**: a dependency manifest (package.json, pom.xml, ...) has 2+ findings from 2+ domains
  - **pattern**: the same rule fires 5+ times across 2+ different files

Results are sorted by severity ceiling (highest first), then by finding count, giving a ranked list of the most problematic areas in the codebase. Use this after merging domain reports to surface root-cause candidates for the LLM synthesis step.

Args:
  - findingsJson (string): JSON string — array of Finding objects (from one or more domain reports).

Returns: A CorrelationResult with a ranked hotspots array and metadata counts per hotspot type.

Error handling:
  - Returns isError: true if findingsJson fails Zod validation.

Examples:
  1. Correlate all findings from a merged report:
     { "findingsJson": "[...all findings from consolidated report...]" }
  2. Correlate only a single domain's findings:
     { "findingsJson": "[...security domain findings only...]" }`,
      inputSchema: {
        findingsJson: z.string().describe("JSON string — array of Finding objects to correlate"),
        responseFormat: ResponseFormatField,
      },
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
          "inspectra_correlate_findings",
        );
      }
      const result = detectHotspots(findings);
      return jsonResponse(result);
    }, "inspectra_correlate_findings"),
  );

  server.registerTool(
    "inspectra_infer_root_causes",
    {
      title: "Infer Root Causes from Hotspots",
      description: `Infer root-cause clusters from correlated hotspots using rule-based policy patterns.

This tool consumes hotspots produced by inspectra_correlate_findings and maps them to a root-cause taxonomy:
  - god-module
  - missing-abstraction
  - dependency-rot
  - test-gap
  - convention-drift
  - misaligned-architecture
  - security-shortcut
  - documentation-debt
  - isolated

Inference strategy:
  1. Deterministic rule matching from policies/root-cause-patterns.yml
  2. Fallback inference for unmatched hotspots with confidence <= 0.6 (category: isolated)

Args:
  - hotspotsJson (string): JSON string — array of hotspot objects from inspectra_correlate_findings.

Returns: RootCauseInferenceResult containing inferred clusters sorted by severity and finding concentration.

Error handling:
  - Returns isError: true if hotspotsJson fails Zod validation.`,
      inputSchema: {
        hotspotsJson: z.string().describe("JSON string — array of hotspot objects to infer root causes from"),
        responseFormat: ResponseFormatField,
      },
      annotations: READ_ONLY_ANNOTATIONS,
    },
    withErrorHandling(async ({ hotspotsJson }) => {
      let hotspots;
      try {
        hotspots = z.array(HotspotInputSchema).parse(JSON.parse(hotspotsJson));
      } catch (err) {
        return errorResponse(
          new ParseError(
            `Invalid hotspotsJson: ${err instanceof Error ? err.message : String(err)}`,
            "Ensure hotspotsJson is a valid JSON array of hotspot objects from inspectra_correlate_findings.",
          ),
          "inspectra_infer_root_causes",
        );
      }

      const patterns = await loadRootCausePatterns(policiesDir);
      const result = inferRootCauseClusters(hotspots, patterns);
      return jsonResponse(result);
    }, "inspectra_infer_root_causes"),
  );
}
