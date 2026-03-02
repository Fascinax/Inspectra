import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { jsonResponse } from "./response.js";
import { analyzeComplexity, ageTodos, checkDependencyStaleness } from "../tools/tech-debt.js";
import { validateProjectDir } from "../utils/paths.js";

/**
 * Registers all tech-debt-domain MCP tools on the given server instance.
 */
export function registerTechDebtTools(server: McpServer): void {
  server.tool(
    "analyze-complexity",
    "Estimate code complexity and flag high-maintenance files",
    { projectDir: z.string().describe("Absolute path to the project root") },
    async ({ projectDir }) => {
      const safeDir = await validateProjectDir(projectDir);
      const findings = await analyzeComplexity(safeDir);
      return jsonResponse(findings);
    },
  );

  server.tool(
    "age-todos",
    "Find aged TODO/FIXME comments from inline dates",
    { projectDir: z.string().describe("Absolute path to the project root") },
    async ({ projectDir }) => {
      const safeDir = await validateProjectDir(projectDir);
      const findings = await ageTodos(safeDir);
      return jsonResponse(findings);
    },
  );

  server.tool(
    "check-dependency-staleness",
    "Detect dependency staleness risks from manifest version patterns",
    { projectDir: z.string().describe("Absolute path to the project root") },
    async ({ projectDir }) => {
      const safeDir = await validateProjectDir(projectDir);
      const findings = await checkDependencyStaleness(safeDir);
      return jsonResponse(findings);
    },
  );
}
