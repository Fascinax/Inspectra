import type { CallToolResult } from "@modelcontextprotocol/sdk/types.js";
import { CHARACTER_LIMIT, DEFAULT_PAGE_SIZE } from "../constants.js";
import { InspectraError } from "../errors.js";
import { logger } from "../logger.js";
import type { ConsolidatedReport, Finding } from "../types.js";
import { renderFindingsAsMarkdown, renderMarkdown } from "../renderer/markdown.js";

export type ResponseFormat = "json" | "markdown";

/**
 * Wraps serializable data into the MCP tool content response format.
 * Returns both human-readable text content and machine-readable structuredContent.
 *
 * When the payload exceeds CHARACTER_LIMIT, arrays are progressively trimmed to
 * produce valid JSON with truncation metadata instead of broken text.
 */
export function jsonResponse(data: unknown): CallToolResult {
  const text = JSON.stringify(data, null, 2);

  if (text.length <= CHARACTER_LIMIT) {
    return {
      content: [{ type: "text", text }],
      structuredContent: data as Record<string, unknown>,
    };
  }

  const truncated = truncatePayload(data);
  const truncatedText = JSON.stringify(truncated, null, 2);

  return {
    content: [{ type: "text", text: truncatedText }],
    structuredContent: truncated as Record<string, unknown>,
  };
}

/**
 * Progressively reduces array-typed data to fit within CHARACTER_LIMIT.
 * Returns a wrapper object with truncation metadata when trimming occurs.
 */
function truncatePayload(data: unknown): unknown {
  const items = findTruncatableArray(data);
  if (!items) {
    const raw = JSON.stringify(data);
    return {
      error: "Response too large to serialize",
      total_characters: raw.length,
      character_limit: CHARACTER_LIMIT,
      truncation_message:
        "The response exceeds the character limit and cannot be reduced. " +
        "Try narrowing your query with more specific file paths or filters.",
    };
  }

  const totalCount = items.length;
  let kept = items.length;

  while (kept > 0) {
    const subset = items.slice(0, kept);
    const candidate = buildTruncatedData(data, subset, totalCount);
    const json = JSON.stringify(candidate, null, 2);
    if (json.length <= CHARACTER_LIMIT) {
      return candidate;
    }
    kept = Math.floor(kept * 0.75);
  }

  return {
    findings: [],
    truncated: true,
    total_count: totalCount,
    returned_count: 0,
    truncation_message:
      "All findings were too large to fit within the response limit. " +
      "Try narrowing your query with more specific file paths or filters.",
  };
}

function findTruncatableArray(data: unknown): unknown[] | null {
  if (Array.isArray(data)) return data;
  if (data !== null && typeof data === "object") {
    const obj = data as Record<string, unknown>;
    if (Array.isArray(obj.findings)) return obj.findings;
    for (const value of Object.values(obj)) {
      if (Array.isArray(value) && value.length > 0) return value;
    }
  }
  return null;
}

function buildTruncatedData(
  original: unknown,
  subset: unknown[],
  totalCount: number,
): Record<string, unknown> {
  if (Array.isArray(original)) {
    return {
      findings: subset,
      truncated: true,
      total_count: totalCount,
      returned_count: subset.length,
      truncation_message:
        `Showing ${subset.length} of ${totalCount} findings. ` +
        "Use more specific file paths or filters to narrow results.",
    };
  }

  const obj = original as Record<string, unknown>;
  const arrayKey = Object.keys(obj).find((k) => {
    const val = obj[k];
    return Array.isArray(val) && val.length === totalCount;
  }) ?? "findings";

  return {
    ...obj,
    [arrayKey]: subset,
    truncated: true,
    total_count: totalCount,
    returned_count: subset.length,
    truncation_message:
      `Showing ${subset.length} of ${totalCount} items. ` +
      "Use more specific file paths or filters to narrow results.",
  };
}

/**
 * Returns a structured MCP error response with actionable guidance.
 *
 * When the error is an `InspectraError`, the response includes a `suggestion`
 * field telling the LLM agent what to try next — following the MCP best-practice
 * of "error messages should guide agents toward solutions".
 *
 * Shape: `{ error, suggestion?, tool_name?, code? }`
 */
export function errorResponse(error: unknown, toolName?: string): CallToolResult {
  const message = error instanceof Error ? error.message : String(error);

  const payload: Record<string, string> = { error: message };

  if (error instanceof InspectraError) {
    payload.code = error.code;
    payload.suggestion = error.suggestion;
  } else {
    payload.suggestion = "An unexpected error occurred. Check tool inputs and retry. If the issue persists, verify the project path and server configuration.";
  }

  if (toolName) {
    payload.tool_name = toolName;
  }

  return {
    content: [{ type: "text", text: JSON.stringify(payload) }],
    isError: true,
  };
}

export interface PaginationParams {
  limit?: number;
  offset?: number;
}

/**
 * Returns findings in the requested format with **response-level** pagination.
 *
 * All findings are computed by the tool before this function is called.
 * Pagination only slices the serialised output to reduce payload size for
 * LLMs with limited context windows. It does NOT reduce scan work.
 *
 * Text content adapts to the format; structuredContent is always JSON.
 */
export function findingsResponse(
  findings: Finding[],
  format: ResponseFormat = "json",
  pagination: PaginationParams = {},
): CallToolResult {
  const { limit = DEFAULT_PAGE_SIZE, offset = 0 } = pagination;
  const total = findings.length;
  const page = findings.slice(offset, offset + limit);
  const hasMore = offset + limit < total;
  const nextOffset = hasMore ? offset + limit : null;

  const envelope = {
    findings: page,
    total,
    count: page.length,
    has_more: hasMore,
    next_offset: nextOffset,
  };

  if (format === "markdown") {
    const header = total > page.length
      ? `> Showing ${page.length} of ${total} findings (offset ${offset}, limit ${limit})\n\n`
      : "";
    return {
      content: [{ type: "text", text: header + renderFindingsAsMarkdown(page) }],
      structuredContent: envelope as unknown as Record<string, unknown>,
    };
  }
  return jsonResponse(envelope);
}

/**
 * Returns a consolidated report in the requested format.
 * Text content adapts to the format; structuredContent is always JSON.
 */
export function reportResponse(
  report: ConsolidatedReport,
  format: ResponseFormat = "json",
): CallToolResult {
  if (format === "markdown") {
    return {
      content: [{ type: "text", text: renderMarkdown(report) }],
      structuredContent: report as unknown as Record<string, unknown>,
    };
  }
  return jsonResponse(report);
}

type AsyncHandler<T> = (params: T) => Promise<CallToolResult>;

/**
 * Wraps a tool handler with try/catch, returning a structured error response
 * instead of throwing. This ensures the MCP client always receives a valid response.
 *
 * @param handler - The async tool handler to wrap.
 * @param toolName - Optional MCP tool name included in error responses for traceability.
 */
export function withErrorHandling<T>(handler: AsyncHandler<T>, toolName?: string): AsyncHandler<T> {
  return async (params: T): Promise<CallToolResult> => {
    try {
      logger.debug(`tool:call ${toolName ?? "unknown"}`, params as Record<string, unknown>);
      const result = await handler(params);
      logger.debug(`tool:ok ${toolName ?? "unknown"}`);
      return result;
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      logger.error(`tool:error ${toolName ?? "unknown"}: ${message}`);
      return errorResponse(error, toolName);
    }
  };
}