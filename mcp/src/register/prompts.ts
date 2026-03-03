import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { readFile } from "node:fs/promises";
import { join } from "node:path";

/**
 * Registers MCP Prompts that provide pre-built audit workflows.
 *
 * Prompts return structured messages that LLMs can use to orchestrate
 * multi-domain audits following Inspectra's standard methodology.
 */
export function registerPrompts(server: McpServer, promptsDir: string): void {
  // ─── Full Audit Prompt ──────────────────────────────────────────────────────
  server.registerPrompt(
    "audit_full",
    {
      title: "Full Multi-Domain Audit",
      description:
        "Run a comprehensive code audit covering all 7 domains (security, tests, architecture, conventions, performance, documentation, tech-debt). Returns a structured workflow with scoring and output format instructions.",
      argsSchema: {
        projectDir: z
          .string()
          .describe("Absolute path to the project directory to audit"),
        profile: z
          .string()
          .default("generic")
          .describe("Policy profile to use for scoring weights (e.g., 'generic', 'java-backend', 'angular-frontend')"),
      },
    },
    async ({ projectDir, profile }) => {
      const template = await readFile(join(promptsDir, "audit-full.prompt.md"), "utf-8");
      const instructions = buildFullAuditInstructions(template, projectDir, profile ?? "generic");
      return {
        messages: [
          {
            role: "user",
            content: { type: "text", text: instructions },
          },
        ],
      };
    },
  );

  // ─── PR Audit Prompt ───────────────────────────────────────────────────────
  server.registerPrompt(
    "audit_pr",
    {
      title: "PR-Focused Audit",
      description:
        "Audit only the files changed in a pull request. Applies a 0.7 minimum confidence threshold and skips info-level findings. Returns a focused review with a merge verdict.",
      argsSchema: {
        projectDir: z
          .string()
          .describe("Absolute path to the project directory to audit"),
        changedFiles: z
          .string()
          .describe("Comma-separated list of file paths changed in the PR (relative to projectDir)"),
      },
    },
    async ({ projectDir, changedFiles }) => {
      const template = await readFile(join(promptsDir, "audit-pr.prompt.md"), "utf-8");
      const instructions = buildPrAuditInstructions(template, projectDir, changedFiles);
      return {
        messages: [
          {
            role: "user",
            content: { type: "text", text: instructions },
          },
        ],
      };
    },
  );
}

function buildFullAuditInstructions(template: string, projectDir: string, profile: string): string {
  return [
    template,
    "",
    "---",
    `**Project directory**: \`${projectDir}\``,
    `**Profile**: \`${profile}\``,
    "",
    "Execute the workflow above on this project now.",
  ].join("\n");
}

function buildPrAuditInstructions(template: string, projectDir: string, changedFiles: string): string {
  const files = changedFiles.split(",").map((f) => f.trim()).filter(Boolean);
  return [
    template,
    "",
    "---",
    `**Project directory**: \`${projectDir}\``,
    `**Changed files** (${files.length}):`,
    ...files.map((f) => `- \`${f}\``),
    "",
    "Execute the PR audit workflow above on these files now.",
  ].join("\n");
}
