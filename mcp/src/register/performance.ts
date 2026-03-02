import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { jsonResponse } from "./response.js";
import { analyzeBundleSize, checkBuildTimings, detectRuntimeMetrics } from "../tools/performance.js";
import { validateProjectDir } from "../utils/paths.js";

/**
 * Registers all performance-domain MCP tools on the given server instance.
 */
export function registerPerformanceTools(server: McpServer): void {
  server.registerTool(
    "analyze-bundle-size",
    {
      title: "Analyze Bundle Size",
      description: "Analyze bundle size from build outputs and flag oversized artifacts",
      inputSchema: {
        projectDir: z.string().describe("Absolute path to the project root"),
      },
      annotations: {
        readOnlyHint: true,
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: false,
      },
    },
    async ({ projectDir }) => {
      const safeDir = await validateProjectDir(projectDir);
      const findings = await analyzeBundleSize(safeDir);
      return jsonResponse(findings);
    },
  );

  server.registerTool(
    "check-build-timings",
    {
      title: "Check Build Timings",
      description: "Parse build timing metrics and flag slow or unstable builds",
      inputSchema: {
        projectDir: z.string().describe("Absolute path to the project root"),
      },
      annotations: {
        readOnlyHint: true,
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: false,
      },
    },
    async ({ projectDir }) => {
      const safeDir = await validateProjectDir(projectDir);
      const findings = await checkBuildTimings(safeDir);
      return jsonResponse(findings);
    },
  );

  server.registerTool(
    "detect-runtime-metrics",
    {
      title: "Detect Runtime Metrics",
      description: "Detect static runtime performance hotspots (sync I/O, blocking calls)",
      inputSchema: {
        projectDir: z.string().describe("Absolute path to the project root"),
      },
      annotations: {
        readOnlyHint: true,
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: false,
      },
    },
    async ({ projectDir }) => {
      const safeDir = await validateProjectDir(projectDir);
      const findings = await detectRuntimeMetrics(safeDir);
      return jsonResponse(findings);
    },
  );
}
