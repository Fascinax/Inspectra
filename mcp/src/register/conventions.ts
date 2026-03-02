import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { jsonResponse } from "./response.js";
import {
  checkNamingConventions,
  checkFileLengths,
  checkTodoFixmes,
  parseLintOutput,
  detectDryViolations,
} from "../tools/conventions.js";
import { loadProfile } from "../policies/loader.js";
import { validateProjectDir } from "../utils/paths.js";

/**
 * Registers all conventions-domain MCP tools on the given server instance.
 *
 * @param server - The MCP server to register tools on.
 * @param policiesDir - Absolute path to the policies directory.
 */
export function registerConventionsTools(server: McpServer, policiesDir: string): void {
  server.tool(
    "check-naming",
    "Verify file and class naming conventions",
    { projectDir: z.string().describe("Absolute path to the project root") },
    async ({ projectDir }) => {
      const safeDir = await validateProjectDir(projectDir);
      const findings = await checkNamingConventions(safeDir);
      return jsonResponse(findings);
    },
  );

  server.tool(
    "check-file-lengths",
    "Flag files exceeding length thresholds",
    {
      projectDir: z.string().describe("Absolute path to the project root"),
      profile: z.string().optional().describe("Policy profile name (e.g., java-angular-playwright)"),
    },
    async ({ projectDir, profile }) => {
      const safeDir = await validateProjectDir(projectDir);
      const profileConfig = profile ? await loadProfile(policiesDir, profile) : undefined;
      const findings = await checkFileLengths(safeDir, profileConfig);
      return jsonResponse(findings);
    },
  );

  server.tool(
    "check-todos",
    "Find unresolved TODO, FIXME, HACK, and XXX comments",
    {
      projectDir: z.string().describe("Absolute path to the project root"),
      profile: z.string().optional().describe("Policy profile name (e.g., java-angular-playwright)"),
    },
    async ({ projectDir }) => {
      const safeDir = await validateProjectDir(projectDir);
      const findings = await checkTodoFixmes(safeDir);
      return jsonResponse(findings);
    },
  );

  server.tool(
    "parse-lint-output",
    "Parse ESLint JSON report or run ESLint, and parse Checkstyle XML output",
    { projectDir: z.string().describe("Absolute path to the project root") },
    async ({ projectDir }) => {
      const safeDir = await validateProjectDir(projectDir);
      const findings = await parseLintOutput(safeDir);
      return jsonResponse(findings);
    },
  );

  server.tool(
    "detect-dry-violations",
    "Detect duplicated code blocks across source files (copy-paste / DRY violations)",
    { projectDir: z.string().describe("Absolute path to the project root") },
    async ({ projectDir }) => {
      const safeDir = await validateProjectDir(projectDir);
      const findings = await detectDryViolations(safeDir);
      return jsonResponse(findings);
    },
  );
}
