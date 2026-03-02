import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { jsonResponse } from "./response.js";
import { analyzeBundleSize, checkBuildTimings, detectRuntimeMetrics } from "../tools/performance.js";
import { validateProjectDir } from "../utils/paths.js";

/**
 * Registers all performance-domain MCP tools on the given server instance.
 */
export function registerPerformanceTools(server: McpServer): void {
  server.tool(
    "analyze-bundle-size",
    "Analyze bundle size from build outputs and flag oversized artifacts",
    { projectDir: z.string().describe("Absolute path to the project root") },
    async ({ projectDir }) => {
      const safeDir = await validateProjectDir(projectDir);
      const findings = await analyzeBundleSize(safeDir);
      return jsonResponse(findings);
    },
  );

  server.tool(
    "check-build-timings",
    "Parse build timing metrics and flag slow or unstable builds",
    { projectDir: z.string().describe("Absolute path to the project root") },
    async ({ projectDir }) => {
      const safeDir = await validateProjectDir(projectDir);
      const findings = await checkBuildTimings(safeDir);
      return jsonResponse(findings);
    },
  );

  server.tool(
    "detect-runtime-metrics",
    "Detect static runtime performance hotspots (sync I/O, blocking calls)",
    { projectDir: z.string().describe("Absolute path to the project root") },
    async ({ projectDir }) => {
      const safeDir = await validateProjectDir(projectDir);
      const findings = await detectRuntimeMetrics(safeDir);
      return jsonResponse(findings);
    },
  );
}
