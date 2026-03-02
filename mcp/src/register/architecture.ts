import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
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
  server.tool(
    "check-layering",
    "Verify clean architecture layer dependencies (presentation → application → domain ← infrastructure)",
    {
      projectDir: z.string().describe("Absolute path to the project root"),
      profile: z.string().optional().describe("Policy profile name (e.g., java-angular-playwright)"),
    },
    async ({ projectDir, profile }) => {
      const safeDir = await validateProjectDir(projectDir);
      const profileConfig = profile ? await loadProfile(policiesDir, profile) : undefined;
      const findings = await checkLayering(safeDir, profileConfig?.architecture?.allowed_dependencies);
      return { content: [{ type: "text", text: JSON.stringify(findings, null, 2) }] };
    },
  );

  server.tool(
    "analyze-dependencies",
    "Analyze package.json dependencies for excessive count or duplication",
    { projectDir: z.string().describe("Absolute path to the project root") },
    async ({ projectDir }) => {
      const safeDir = await validateProjectDir(projectDir);
      const findings = await analyzeModuleDependencies(safeDir);
      return { content: [{ type: "text", text: JSON.stringify(findings, null, 2) }] };
    },
  );

  server.tool(
    "detect-circular-deps",
    "Detect circular import chains between source files",
    { projectDir: z.string().describe("Absolute path to the project root") },
    async ({ projectDir }) => {
      const safeDir = await validateProjectDir(projectDir);
      const findings = await detectCircularDependencies(safeDir);
      return { content: [{ type: "text", text: JSON.stringify(findings, null, 2) }] };
    },
  );
}
