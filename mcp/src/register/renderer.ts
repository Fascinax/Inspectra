import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { ConsolidatedReportSchema } from "../types.js";
import { buildTrendEntry, analyzeTrend, renderTrendMarkdown } from "../renderer/trend.js";
import { compareReports, renderComparisonMarkdown } from "../renderer/compare.js";
import { jsonResponse, errorResponse, withErrorHandling } from "./response.js";
import { ResponseFormatField } from "./schemas.js";
import { ParseError } from "../errors.js";

/**
 * Registers report engine MCP tools: trend analysis and report comparison.
 *
 * @param server - The MCP server to register tools on.
 */
export function registerRendererTools(server: McpServer): void {
  registerRenderTrendTool(server);
  registerCompareReportsTool(server);
}

function registerRenderTrendTool(server: McpServer): void {
  server.registerTool(
    "inspectra_render_trend",
    {
      title: "Render Score Trend",
      description: `Compute and render a score trend from multiple consecutive consolidated audit reports.

Accepts an array of consolidated audit report JSON objects ordered chronologically. Computes direction (improving / declining / stable), average score, best score, worst score, and overall change. Returns a Markdown trend table with history.

Args:
  - reportsJson (string): JSON string containing an array of ConsolidatedReport objects, oldest-first.
  - responseFormat (optional): "markdown" returns the rendered Markdown table; "json" returns the TrendData object (default: json).

Returns: TrendData with direction, averageScore, bestScore, worstScore, scoreChange, and up to 10 history entries.

Error handling:
  - Returns isError: true if reportsJson fails Zod validation or contains fewer than 2 entries.

Examples:
  1. Trend over three monthly audits:
     { "reportsJson": "[{...audit-jan...}, {...audit-feb...}, {...audit-mar...}]" }
  2. Get Markdown table directly:
     { "reportsJson": "[...]", "responseFormat": "markdown" }`,
      inputSchema: {
        reportsJson: z.string().describe("JSON string — array of ConsolidatedReport objects, oldest-first"),
        responseFormat: ResponseFormatField,
      },
      annotations: {
        readOnlyHint: true,
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: false,
      },
    },
    withErrorHandling(async ({ reportsJson, responseFormat }) => {
      let reports;
      try {
        reports = z.array(ConsolidatedReportSchema).parse(JSON.parse(reportsJson));
      } catch (err) {
        return errorResponse(
          new ParseError(
            `Invalid reportsJson: ${err instanceof Error ? err.message : String(err)}`,
            "Ensure reportsJson is a valid JSON array of ConsolidatedReport objects. Each report must conform to consolidated-report.schema.json.",
          ),
          "inspectra_render_trend",
        );
      }

      if (reports.length < 2) {
        return errorResponse(
          new ParseError(
            "At least 2 reports are required to compute a trend.",
            "Provide a JSON array with 2 or more ConsolidatedReport objects in chronological order.",
          ),
          "inspectra_render_trend",
        );
      }

      const entries = reports.map(buildTrendEntry);
      const trend = analyzeTrend(entries);

      if (responseFormat === "markdown") {
        return { content: [{ type: "text" as const, text: renderTrendMarkdown(trend) }] };
      }

      return jsonResponse(trend);
    }, "inspectra_render_trend"),
  );
}

function registerCompareReportsTool(server: McpServer): void {
  server.registerTool(
    "inspectra_compare_reports",
    {
      title: "Compare Audit Reports",
      description: `Compare two consolidated audit reports side-by-side to identify score changes and finding diffs.

Accepts two consolidated audit report JSON objects (baseline and current). Returns the overall score delta, per-domain comparison table, and categorised finding changes: added, removed, and unchanged — sorted by severity.

Args:
  - reportAJson (string): JSON string of the baseline (older) ConsolidatedReport.
  - reportBJson (string): JSON string of the current (newer) ConsolidatedReport.
  - labelA (string, optional): Display label for reportA (default: "Baseline").
  - labelB (string, optional): Display label for reportB (default: "Current").
  - responseFormat (optional): "markdown" returns a rendered diff Markdown table; "json" returns the ComparisonResult object (default: json).

Returns: ComparisonResult with overallDelta, per-domain score deltas, and finding arrays (added / removed / unchanged).

Error handling:
  - Returns isError: true if either report JSON fails Zod validation.

Examples:
  1. Compare main to a PR branch audit:
     { "reportAJson": "{...main...}", "reportBJson": "{...pr...}", "labelA": "main", "labelB": "feature/auth" }
  2. Get Markdown diff:
     { "reportAJson": "{...}", "reportBJson": "{...}", "responseFormat": "markdown" }`,
      inputSchema: {
        reportAJson: z.string().describe("JSON string of the baseline ConsolidatedReport"),
        reportBJson: z.string().describe("JSON string of the current ConsolidatedReport"),
        labelA: z.string().default("Baseline").describe("Display label for reportA (default: Baseline)"),
        labelB: z.string().default("Current").describe("Display label for reportB (default: Current)"),
        responseFormat: ResponseFormatField,
      },
      annotations: {
        readOnlyHint: true,
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: false,
      },
    },
    withErrorHandling(async ({ reportAJson, reportBJson, labelA, labelB, responseFormat }) => {
      let reportA;
      try {
        reportA = ConsolidatedReportSchema.parse(JSON.parse(reportAJson));
      } catch (err) {
        return errorResponse(
          new ParseError(
            `Invalid reportAJson: ${err instanceof Error ? err.message : String(err)}`,
            "Ensure reportAJson is a valid ConsolidatedReport JSON object conforming to consolidated-report.schema.json.",
          ),
          "inspectra_compare_reports",
        );
      }

      let reportB;
      try {
        reportB = ConsolidatedReportSchema.parse(JSON.parse(reportBJson));
      } catch (err) {
        return errorResponse(
          new ParseError(
            `Invalid reportBJson: ${err instanceof Error ? err.message : String(err)}`,
            "Ensure reportBJson is a valid ConsolidatedReport JSON object conforming to consolidated-report.schema.json.",
          ),
          "inspectra_compare_reports",
        );
      }

      const result = compareReports(reportA, reportB, labelA, labelB);

      if (responseFormat === "markdown") {
        return { content: [{ type: "text" as const, text: renderComparisonMarkdown(result) }] };
      }

      return jsonResponse(result);
    }, "inspectra_compare_reports"),
  );
}
