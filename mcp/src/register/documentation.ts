import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { jsonResponse } from "./response.js";
import { checkReadmeCompleteness, checkAdrPresence, detectDocCodeDrift } from "../tools/documentation.js";
import { validateProjectDir } from "../utils/paths.js";

/**
 * Registers all documentation-domain MCP tools on the given server instance.
 */
export function registerDocumentationTools(server: McpServer): void {
  server.tool(
    "check-readme-completeness",
    "Evaluate README presence and completeness against baseline sections",
    { projectDir: z.string().describe("Absolute path to the project root") },
    async ({ projectDir }) => {
      const safeDir = await validateProjectDir(projectDir);
      const findings = await checkReadmeCompleteness(safeDir);
      return jsonResponse(findings);
    },
  );

  server.tool(
    "check-adr-presence",
    "Check whether ADR documents are present under docs/adr or docs/adrs",
    { projectDir: z.string().describe("Absolute path to the project root") },
    async ({ projectDir }) => {
      const safeDir = await validateProjectDir(projectDir);
      const findings = await checkAdrPresence(safeDir);
      return jsonResponse(findings);
    },
  );

  server.tool(
    "detect-doc-code-drift",
    "Detect mismatches between package scripts and README usage instructions",
    { projectDir: z.string().describe("Absolute path to the project root") },
    async ({ projectDir }) => {
      const safeDir = await validateProjectDir(projectDir);
      const findings = await detectDocCodeDrift(safeDir);
      return jsonResponse(findings);
    },
  );
}
