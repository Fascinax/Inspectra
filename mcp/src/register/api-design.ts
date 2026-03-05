import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { findingsResponse, withErrorHandling } from "./response.js";
import { STANDARD_INPUT_SCHEMA, FINDINGS_TOOL_META } from "./schemas.js";
import { checkRestConventions } from "../tools/api-design.js";
import { validateProjectDir } from "../utils/paths.js";

/**
 * Registers all api-design-domain MCP tools on the given server instance.
 */
export function registerApiDesignTools(server: McpServer): void {
  server.registerTool(
    "inspectra_check_rest_conventions",
    {
      title: "Check REST API Design Conventions",
      description: `Scan route definitions for common REST API design anti-patterns.

Checks for: verb-based resource names (/getUsers, /createOrder), missing API version prefix (/api/v1/), and inconsistent resource naming. Supports Express/Hapi.js, NestJS, and Spring MVC route annotations.

Args:
  - projectDir (string): Absolute path to the project root.

Returns: Array of Finding objects (domain: "api-design", prefix: API-). Each finding points to the offending route definition and provides a corrected example.

Error handling:
  - Throws if projectDir does not exist or is not a directory.

Examples:
  1. Check REST conventions in a Node.js project:
     { "projectDir": "/app/my-express-api" }
  2. Check a Spring Boot project:
     { "projectDir": "/app/my-spring-app" }`,
      inputSchema: STANDARD_INPUT_SCHEMA,
      ...FINDINGS_TOOL_META,
    },
    withErrorHandling(async ({ projectDir, responseFormat, limit, offset }) => {
      const safeDir = await validateProjectDir(projectDir);
      const findings = await checkRestConventions(safeDir);
      return findingsResponse(findings, responseFormat, { limit, offset });
    }, "inspectra_check_rest_conventions"),
  );
}
