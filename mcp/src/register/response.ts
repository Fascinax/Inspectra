/**
 * Wraps serializable data into the MCP tool content response format.
 *
 * @param data - The data to serialize as JSON.
 * @returns MCP tool response with JSON-formatted text content.
 */
export function jsonResponse(data: unknown): { content: [{ type: "text"; text: string }] } {
  return { content: [{ type: "text", text: JSON.stringify(data, null, 2) }] };
}
