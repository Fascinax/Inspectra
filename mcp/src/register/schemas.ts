import { z } from "zod";
import { SEVERITY_LEVELS, DOMAINS, EFFORT_LEVELS } from "../types.js";
import { DEFAULT_PAGE_SIZE } from "../constants.js";

/** Reusable input field for selecting the tool response format. */
export const ResponseFormatField = z
  .enum(["json", "markdown"])
  .default("json")
  .describe("Output format: json for structured data, markdown for human-readable text");

/**
 * Maximum number of findings to return per page.
 *
 * This is **response-level pagination**: all findings are computed by the tool
 * first, then sliced before serialisation. It reduces response payload size for
 * LLMs with limited context windows but does NOT skip any scanning work.
 *
 * Default: DEFAULT_PAGE_SIZE (env INSPECTRA_DEFAULT_PAGE_SIZE, fallback 50).
 */
export const LimitField = z
  .number({ invalid_type_error: "limit must be a number" })
  .int({ message: "limit must be an integer" })
  .positive({ message: "limit must be greater than 0" })
  .default(DEFAULT_PAGE_SIZE)
  .describe(`Maximum number of findings to return (default: ${DEFAULT_PAGE_SIZE}). This is response-level pagination — all findings are computed, then sliced.`);

/**
 * Number of findings to skip (pagination offset).
 * Use together with limit to iterate through pages.
 */
export const OffsetField = z
  .number({ invalid_type_error: "offset must be a number" })
  .int({ message: "offset must be an integer" })
  .nonnegative({ message: "offset must be 0 or greater" })
  .default(0)
  .describe("Number of findings to skip for pagination (default: 0)");

/**
 * Reusable Zod field for projectDir inputs with validation message.
 * Ensures the value is a non-empty string. Actual path validation
 * (absolute, exists, is-directory) is done by validateProjectDir in the handler.
 */
export const ProjectDirField = z
  .string({ required_error: "projectDir is required" })
  .min(1, "projectDir cannot be empty — provide an absolute path to the project root")
  .describe("Absolute path to the project root");

/**
 * Reusable Zod field for optional profile name input.
 */
export const ProfileField = z
  .string()
  .min(1, "profile cannot be empty when provided")
  .optional()
  .describe("Policy profile name (e.g., java-angular-playwright, generic)");

/**
 * Shared Zod output schema for tool responses that return an array of findings.
 * Used as `outputSchema` in `registerTool` to give agents structured type information.
 */
export const FindingsOutputSchema = {
  findings: z.array(
    z.object({
      id: z.string().describe("Finding ID (e.g. SEC-001, TST-042)"),
      severity: z.enum(SEVERITY_LEVELS).describe("Severity level"),
      title: z.string().describe("Short finding title"),
      description: z.string().optional().describe("Detailed explanation"),
      domain: z.enum(DOMAINS).describe("Audit domain"),
      rule: z.string().describe("Machine-readable rule identifier"),
      confidence: z.number().describe("Confidence score between 0.0 and 1.0"),
      evidence: z
        .array(
          z.object({
            file: z.string().describe("File path"),
            line: z.number().optional().describe("Line number"),
            snippet: z.string().optional().describe("Code snippet"),
          }),
        )
        .describe("Evidence locations"),
      recommendation: z.string().optional().describe("Suggested fix"),
      effort: z.enum(EFFORT_LEVELS).optional().describe("Estimated fix effort"),
      tags: z.array(z.string()).optional().describe("Classification tags"),
    }),
  ),
  total: z.number().int().describe("Total number of findings before pagination"),
  count: z.number().int().describe("Number of findings returned in this page"),
  has_more: z.boolean().describe("Whether more findings are available beyond this page"),
  next_offset: z.number().int().nullable().describe("Offset to use for the next page, or null if no more pages"),
};

/** Output schema for the score-findings tool. */
export const ScoreOutputSchema = {
  score: z.number().int().min(0).max(100).describe("Computed domain score (0-100)"),
};
