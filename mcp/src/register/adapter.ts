import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { writeFile } from "node:fs/promises";
import { join, resolve } from "node:path";
import { jsonResponse, withErrorHandling } from "./response.js";
import { generateClaudeMd, generateCodexAgentsMd } from "../tools/adapter.js";
import { validateProjectDir } from "../utils/paths.js";

/**
 * Registers adapter MCP tools (Claude Code integration) on the given server.
 */
export function registerAdapterTools(server: McpServer): void {
  server.registerTool(
    "inspectra_generate_claude_md",
    {
      title: "Generate CLAUDE.md",
      description: `Generate a CLAUDE.md reference file that exposes Inspectra agents to Claude Code.

Reads all .agent.md files from the .github/agents/ directory (relative to projectDir) and compiles them into a single CLAUDE.md document suitable for use as Claude Code project context.

When outputPath is provided the file is written to disk and a compact summary is returned. When omitted the content is returned inline.

Args:
  - projectDir (string): Absolute path to the project root. Agent files are read from <projectDir>/.github/agents/.
  - outputPath (string, optional): Absolute or relative path where CLAUDE.md should be written. Defaults to <projectDir>/CLAUDE.md when not specified.
  - write (boolean, optional): When true and outputPath is not specified, writes to <projectDir>/CLAUDE.md. Default: false.

Returns: JSON object with { content, agentCount, agentFiles, outputPath? }.

Error handling:
  - Throws if projectDir does not exist or is not a directory.
  - Returns agentCount: 0 with a minimal CLAUDE.md when no agent files are found.

Examples:
  1. Generate CLAUDE.md and write to project root:
     { "projectDir": "/app/inspectra", "write": true }
  2. Generate with custom output path:
     { "projectDir": "/app/inspectra", "outputPath": "/app/inspectra/CLAUDE.md" }
  3. Generate inline (no file write):
     { "projectDir": "/app/inspectra" }`,
      inputSchema: {
        projectDir: z
          .string()
          .describe("Absolute path to the project root directory."),
        outputPath: z
          .string()
          .optional()
          .describe("Where to write CLAUDE.md. Defaults to <projectDir>/CLAUDE.md when write: true."),
        write: z
          .boolean()
          .optional()
          .default(false)
          .describe("Write the generated content to disk when true."),
      },
      annotations: {
        readOnlyHint: false,
        destructiveHint: false,
        idempotentHint: true,
      },
    },
    withErrorHandling(async ({ projectDir, outputPath, write }) => {
      const safeDir = await validateProjectDir(projectDir);
      const agentsDir = join(safeDir, ".github", "agents");

      const result = await generateClaudeMd(agentsDir);

      const resolvedOutputPath = outputPath
        ? resolve(outputPath)
        : write
          ? join(safeDir, "CLAUDE.md")
          : null;

      if (resolvedOutputPath) {
        await writeFile(resolvedOutputPath, result.content, "utf-8");
        return jsonResponse({
          agentCount: result.agentCount,
          agentFiles: result.agentFiles,
          outputPath: resolvedOutputPath,
          message: `CLAUDE.md written to ${resolvedOutputPath} (${result.agentCount} agent(s) included).`,
        });
      }

      return jsonResponse({
        agentCount: result.agentCount,
        agentFiles: result.agentFiles,
        content: result.content,
      });
    }, "inspectra_generate_claude_md"),
  );

  // ─── Codex AGENTS.md tool ────────────────────────────────────────────────

  server.registerTool(
    "inspectra_generate_codex_agents_md",
    {
      title: "Generate Codex AGENTS.md",
      description: `Generate an AGENTS.md file that exposes Inspectra agents to OpenAI Codex.

Reads all .agent.md files from the .github/agents/ directory (relative to projectDir) and compiles them into a single AGENTS.md document with audit workflow instructions, MCP tools reference, scoring model, and finding contract — suitable for use as Codex project instructions.

When write is true, the file is written to disk at <projectDir>/AGENTS.md (or outputPath if specified).

Args:
  - projectDir (string): Absolute path to the project root.
  - outputPath (string, optional): Where to write AGENTS.md. Defaults to <projectDir>/AGENTS.md when write: true.
  - write (boolean, optional): Write to disk when true. Default: false.

Returns: JSON object with { content, agentCount, agentFiles, outputPath? }.`,
      inputSchema: {
        projectDir: z
          .string()
          .describe("Absolute path to the project root directory."),
        outputPath: z
          .string()
          .optional()
          .describe("Where to write AGENTS.md. Defaults to <projectDir>/AGENTS.md when write: true."),
        write: z
          .boolean()
          .optional()
          .default(false)
          .describe("Write the generated content to disk when true."),
      },
      annotations: {
        readOnlyHint: false,
        destructiveHint: false,
        idempotentHint: true,
      },
    },
    withErrorHandling(async ({ projectDir, outputPath, write }) => {
      const safeDir = await validateProjectDir(projectDir);
      const agentsDir = join(safeDir, ".github", "agents");

      const result = await generateCodexAgentsMd(agentsDir);

      const resolvedOutputPath = outputPath
        ? resolve(outputPath)
        : write
          ? join(safeDir, "AGENTS.md")
          : null;

      if (resolvedOutputPath) {
        await writeFile(resolvedOutputPath, result.content, "utf-8");
        return jsonResponse({
          agentCount: result.agentCount,
          agentFiles: result.agentFiles,
          outputPath: resolvedOutputPath,
          message: `AGENTS.md written to ${resolvedOutputPath} (${result.agentCount} agent(s) included).`,
        });
      }

      return jsonResponse({
        agentCount: result.agentCount,
        agentFiles: result.agentFiles,
        content: result.content,
      });
    }, "inspectra_generate_codex_agents_md"),
  );
}
