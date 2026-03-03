import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { jsonResponse } from "./response.js";
import { checkReadmeCompleteness, checkAdrPresence, detectDocCodeDrift } from "../tools/documentation.js";
import { validateProjectDir } from "../utils/paths.js";

/**
 * Registers all documentation-domain MCP tools on the given server instance.
 */
export function registerDocumentationTools(server: McpServer): void {
  server.registerTool(
    "inspectra_check_readme_completeness",
    {
      title: "Check README Completeness",
      description: "Evaluate README presence and completeness against baseline sections",
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
      const findings = await checkReadmeCompleteness(safeDir);
      return jsonResponse(findings);
    },
  );

  server.registerTool(
    "inspectra_check_adr_presence",
    {
      title: "Check ADR Presence",
      description: "Check whether ADR documents are present under docs/adr or docs/adrs",
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
      const findings = await checkAdrPresence(safeDir);
      return jsonResponse(findings);
    },
  );

  server.registerTool(
    "inspectra_detect_doc_code_drift",
    {
      title: "Detect Doc-Code Drift",
      description: "Detect mismatches between package scripts and README usage instructions",
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
      const findings = await detectDocCodeDrift(safeDir);
      return jsonResponse(findings);
    },
  );
}
