import type { CallToolResult } from "@modelcontextprotocol/sdk/types.js";
import { CHARACTER_LIMIT } from "../constants.js";

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
 * Returns a structured MCP error response.
 */
export function errorResponse(error: unknown): CallToolResult {
  const message = error instanceof Error ? error.message : String(error);
  return {
    content: [{ type: "text", text: JSON.stringify({ error: message }) }],
    isError: true,
  };
}

type AsyncHandler<T> = (params: T) => Promise<CallToolResult>;

/**
 * Wraps a tool handler with try/catch, returning a structured error response
 * instead of throwing. This ensures the MCP client always receives a valid response.
 */
export function withErrorHandling<T>(handler: AsyncHandler<T>): AsyncHandler<T> {
  return async (params: T): Promise<CallToolResult> => {
    try {
      return await handler(params);
    } catch (error) {
      return errorResponse(error);
    }
  };
}