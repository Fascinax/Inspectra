import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { findingsResponse, withErrorHandling } from "./response.js";
import { FindingsOutputSchema, ResponseFormatField } from "./schemas.js";
import { analyzeBundleSize, checkBuildTimings, detectRuntimeMetrics } from "../tools/performance.js";
import { validateProjectDir } from "../utils/paths.js";

/**
 * Registers all performance-domain MCP tools on the given server instance.
 */
export function registerPerformanceTools(server: McpServer): void {
  server.registerTool(
    "inspectra_analyze_bundle_size",
    {
      title: "Analyze Bundle Size",
      description: `Analyze front-end bundle size from build outputs and flag oversized artifacts that degrade load time.

Searches for webpack stats, Vite manifest, and Angular build output in dist/, build/, and .next/ directories. Compares individual chunk sizes and total bundle size against thresholds.

Args:
  - projectDir (string): Absolute path to the project root.

Returns: Array of Finding objects (domain: "performance", prefix: PRF-). Each finding identifies the oversized bundle or chunk, its size, and the threshold exceeded.

Error handling:
  - Returns empty findings if no build artifacts are found.
  - Throws if projectDir does not exist or is not a directory.`,
      inputSchema: {
        projectDir: z.string().describe("Absolute path to the project root"),
        responseFormat: ResponseFormatField,
      },
      outputSchema: FindingsOutputSchema,
      annotations: {
        readOnlyHint: true,
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: false,
      },
    },
    withErrorHandling(async ({ projectDir, responseFormat }) => {
      const safeDir = await validateProjectDir(projectDir);
      const findings = await analyzeBundleSize(safeDir);
      return findingsResponse(findings, responseFormat);
    }),
  );

  server.registerTool(
    "inspectra_check_build_timings",
    {
      title: "Check Build Timings",
      description: `Parse build timing metrics from CI artifacts and flag slow or unstable builds.

Looks for timing data in webpack stats, Gradle build scans, and Maven surefire reports. Flags builds exceeding configurable duration thresholds.

Args:
  - projectDir (string): Absolute path to the project root.

Returns: Array of Finding objects (domain: "performance", prefix: PRF-). Each finding reports the build step name, duration, and whether it exceeded the threshold.

Error handling:
  - Returns empty findings if no build timing data is found.
  - Throws if projectDir does not exist or is not a directory.`,
      inputSchema: {
        projectDir: z.string().describe("Absolute path to the project root"),
        responseFormat: ResponseFormatField,
      },
      outputSchema: FindingsOutputSchema,
      annotations: {
        readOnlyHint: true,
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: false,
      },
    },
    withErrorHandling(async ({ projectDir, responseFormat }) => {
      const safeDir = await validateProjectDir(projectDir);
      const findings = await checkBuildTimings(safeDir);
      return findingsResponse(findings, responseFormat);
    }),
  );

  server.registerTool(
    "inspectra_detect_runtime_metrics",
    {
      title: "Detect Runtime Metrics",
      description: `Detect static runtime performance hotspots by scanning source code for known anti-patterns.

Identifies synchronous I/O calls (fs.readFileSync, writeFileSync), blocking event-loop patterns, and missing async/await in hot paths. Pure static analysis � no runtime instrumentation required.

Args:
  - projectDir (string): Absolute path to the project root.

Returns: Array of Finding objects (domain: "performance", prefix: PRF-). Each finding identifies the file, line, anti-pattern type, and a suggested asynchronous alternative.

Error handling:
  - Throws if projectDir does not exist or is not a directory.`,
      inputSchema: {
        projectDir: z.string().describe("Absolute path to the project root"),
        responseFormat: ResponseFormatField,
      },
      outputSchema: FindingsOutputSchema,
      annotations: {
        readOnlyHint: true,
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: false,
      },
    },
    withErrorHandling(async ({ projectDir, responseFormat }) => {
      const safeDir = await validateProjectDir(projectDir);
      const findings = await detectRuntimeMetrics(safeDir);
      return findingsResponse(findings, responseFormat);
    }),
  );
}