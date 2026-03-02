import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { jsonResponse } from "./response.js";
import { checkLayering, analyzeModuleDependencies, detectCircularDependencies } from "../tools/architecture.js";
import { loadProfile } from "../policies/loader.js";
import { validateProjectDir } from "../utils/paths.js";

/**
 * Registers all architecture-domain MCP tools on the given server instance.
 *
 * @param server - The MCP server to register tools on.
 * @param policiesDir - Absolute path to the policies directory.
 */
export function registerArchitectureTools(server: McpServer, policiesDir: string): void {
  server.registerTool(
    "check-layering",
    {
      title: "Check Layering",
      description: "Verify clean architecture layer dependencies (presentation → application → domain ← infrastructure)",
      inputSchema: {
        projectDir: z.string().describe("Absolute path to the project root"),
        profile: z.string().optional().describe("Policy profile name (e.g., java-angular-playwright)"),
      },
      annotations: {
        readOnlyHint: true,
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: false,
      },
    },
    async ({ projectDir, profile }) => {
      const safeDir = await validateProjectDir(projectDir);
      const profileConfig = profile ? await loadProfile(policiesDir, profile) : undefined;
      const findings = await checkLayering(safeDir, profileConfig?.architecture?.allowed_dependencies);
      return jsonResponse(findings);
    },
  );

  server.registerTool(
    "analyze-dependencies",
    {
      title: "Analyze Dependencies",
      description: "Analyze package.json dependencies for excessive count or duplication",
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
      const findings = await analyzeModuleDependencies(safeDir);
      return jsonResponse(findings);
    },
  );

  server.registerTool(
    "detect-circular-deps",
    {
      title: "Detect Circular Dependencies",
      description: "Detect circular import chains between source files",
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
      const findings = await detectCircularDependencies(safeDir);
      return jsonResponse(findings);
    },
  );
}
