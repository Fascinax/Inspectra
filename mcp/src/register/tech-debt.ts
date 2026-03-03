import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { jsonResponse } from "./response.js";
import { analyzeComplexity, ageTodos, checkDependencyStaleness } from "../tools/tech-debt.js";
import { validateProjectDir } from "../utils/paths.js";

/**
 * Registers all tech-debt-domain MCP tools on the given server instance.
 */
export function registerTechDebtTools(server: McpServer): void {
  server.registerTool(
    "inspectra_analyze_complexity",
    {
      title: "Analyze Complexity",
      description: "Estimate code complexity and flag high-maintenance files",
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
      const findings = await analyzeComplexity(safeDir);
      return jsonResponse(findings);
    },
  );

  server.registerTool(
    "inspectra_age_todos",
    {
      title: "Age TODOs",
      description: "Find aged TODO/FIXME comments from inline dates",
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
      const findings = await ageTodos(safeDir);
      return jsonResponse(findings);
    },
  );

  server.registerTool(
    "inspectra_check_dependency_staleness",
    {
      title: "Check Dependency Staleness",
      description: "Detect dependency staleness risks from manifest version patterns",
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
      const findings = await checkDependencyStaleness(safeDir);
      return jsonResponse(findings);
    },
  );
}
