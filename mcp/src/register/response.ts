import type { CallToolResult } from "@modelcontextprotocol/sdk/types.js";
import { CHARACTER_LIMIT } from "../constants.js";

/**
 * Wraps serializable data into the MCP tool content response format.
 * Returns both human-readable text content and machine-readable structuredContent.
 * Automatically truncates the JSON payload if it exceeds CHARACTER_LIMIT.
 */
export function jsonResponse(data: unknown): CallToolResult {
  let text = JSON.stringify(data, null, 2);
  if (text.length > CHARACTER_LIMIT) {
    text = text.slice(0, CHARACTER_LIMIT) + "\n... [truncated at CHARACTER_LIMIT]";
  }
  return {
    content: [{ type: "text", text }],
    structuredContent: data as Record<string, unknown>,
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