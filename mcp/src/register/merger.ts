import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { mergeReports } from "../merger/merge-findings.js";
import { scoreDomain } from "../merger/score.js";
import { loadAllPolicies, loadScoringRules } from "../policies/loader.js";
import { DomainReportSchema, FindingSchema } from "../types.js";

/**
 * Registers the merger and scoring MCP tools on the given server instance.
 *
 * @param server - The MCP server to register tools on.
 * @param policiesDir - Absolute path to the policies directory.
 */
export function registerMergerTools(server: McpServer, policiesDir: string): void {
  server.tool(
    "merge-domain-reports",
    "Merge multiple domain reports into a consolidated audit report with scoring and deduplication",
    {
      domainReportsJson: z.string().describe("JSON string — array of domain report objects"),
      target: z.string().describe("Repository or path being audited"),
      profile: z.string().describe("Policy profile used (e.g., java-angular-playwright)"),
    },
    async ({ domainReportsJson, target, profile }) => {
      let domainReports;
      try {
        domainReports = z.array(DomainReportSchema).parse(JSON.parse(domainReportsJson));
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        return {
          content: [{ type: "text", text: JSON.stringify({ error: `Invalid domainReportsJson: ${msg}` }) }],
          isError: true,
        };
      }
      const policies = await loadAllPolicies(policiesDir, profile);
      const consolidated = mergeReports(domainReports, target, profile, policies);
      return { content: [{ type: "text", text: JSON.stringify(consolidated, null, 2) }] };
    },
  );

  server.tool(
    "score-findings",
    "Compute a domain score from a list of findings",
    { findingsJson: z.string().describe("JSON string — array of finding objects") },
    async ({ findingsJson }) => {
      let findings;
      try {
        findings = z.array(FindingSchema).parse(JSON.parse(findingsJson));
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        return {
          content: [{ type: "text", text: JSON.stringify({ error: `Invalid findingsJson: ${msg}` }) }],
          isError: true,
        };
      }
      const scoring = await loadScoringRules(policiesDir);
      const score = scoreDomain(findings, scoring);
      return { content: [{ type: "text", text: JSON.stringify({ score }, null, 2) }] };
    },
  );
}
