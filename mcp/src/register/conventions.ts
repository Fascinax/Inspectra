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
  server.registerTool(
    "check-naming",
    {
      title: "Check Naming",
      description: "Verify file and class naming conventions",
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
      const findings = await checkNamingConventions(safeDir);
      return jsonResponse(findings);
    },
  );

  server.registerTool(
    "check-file-lengths",
    {
      title: "Check File Lengths",
      description: "Flag files exceeding length thresholds",
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
      const findings = await checkFileLengths(safeDir, profileConfig);
      return jsonResponse(findings);
    },
  );

  server.registerTool(
    "check-todos",
    {
      title: "Check TODOs",
      description: "Find unresolved TODO, FIXME, HACK, and XXX comments",
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
    async ({ projectDir }) => {
      const safeDir = await validateProjectDir(projectDir);
      const findings = await checkTodoFixmes(safeDir);
      return jsonResponse(findings);
    },
  );

  server.registerTool(
    "parse-lint-output",
    {
      title: "Parse Lint Output",
      description: "Parse ESLint JSON report or run ESLint, and parse Checkstyle XML output",
      inputSchema: {
        projectDir: z.string().describe("Absolute path to the project root"),
      },
      annotations: {
        readOnlyHint: true,
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: true,
      },
    },
    async ({ projectDir }) => {
      const safeDir = await validateProjectDir(projectDir);
      const findings = await parseLintOutput(safeDir);
      return jsonResponse(findings);
    },
  );

  server.registerTool(
    "detect-dry-violations",
    {
      title: "Detect DRY Violations",
      description: "Detect duplicated code blocks across source files (copy-paste / DRY violations)",
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
      const findings = await detectDryViolations(safeDir);
      return jsonResponse(findings);
    },
  );
}
