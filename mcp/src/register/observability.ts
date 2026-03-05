import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { findingsResponse, withErrorHandling } from "./response.js";
import { STANDARD_INPUT_SCHEMA, FINDINGS_TOOL_META } from "./schemas.js";
import { checkObservability } from "../tools/observability.js";
import { validateProjectDir } from "../utils/paths.js";
import { loadProjectConfig, resolveConfig } from "../utils/project-config.js";

/**
 * Registers all observability-domain MCP tools on the given server instance.
 */
export function registerObservabilityTools(server: McpServer): void {
  server.registerTool(
    "inspectra_check_observability",
    {
      title: "Check Observability Coverage",
      description: `Scan source files for observability gaps: swallowed exceptions, missing health endpoints, and absent tracing or metrics instrumentation.

Checks for: catch blocks that neither log nor re-throw errors, absence of /health or /ready endpoints, no OpenTelemetry/Jaeger/Zipkin setup, and no Prometheus/metrics instrumentation.

Args:
  - projectDir (string): Absolute path to the project root.

Returns: Array of Finding objects (domain: "observability", prefix: OBS-). Each finding describes the gap and provides concrete remediation steps.

Error handling:
  - Throws if projectDir does not exist or is not a directory.

Examples:
  1. Check observability in a Node.js service:
     { "projectDir": "/app/my-service" }
  2. Return paginated findings:
     { "projectDir": "/app/my-service", "limit": 20, "offset": 0 }`,
      inputSchema: STANDARD_INPUT_SCHEMA,
      ...FINDINGS_TOOL_META,
    },
    withErrorHandling(async ({ projectDir, responseFormat, limit, offset }) => {
      const safeDir = await validateProjectDir(projectDir);
      const config = resolveConfig(await loadProjectConfig(safeDir));
      const findings = await checkObservability(safeDir, config.ignore_dirs);
      return findingsResponse(findings, responseFormat, { limit, offset });
    }, "inspectra_check_observability"),
  );
}
