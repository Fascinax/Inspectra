import { readFile, readdir } from "node:fs/promises";
import { join, basename } from "node:path";
import { existsSync } from "node:fs";

// ─── Types ─────────────────────────────────────────────────────────────────────

export interface ClaudeMdResult {
  /** The full content of the generated CLAUDE.md file */
  content: string;
  /** Number of agent files that were read successfully */
  agentCount: number;
  /** Agent file names that were included */
  agentFiles: string[];
}

// ─── Generator ────────────────────────────────────────────────────────────────

/**
 * Generates a `CLAUDE.md` file that exposes Inspectra's agent system to
 * Claude Code (claude.ai projects feature). It reads all `.agent.md` files
 * from the given agents directory and formats them as a single reference doc
 * that Claude Code can use as project context.
 */
export async function generateClaudeMd(agentsDir: string): Promise<ClaudeMdResult> {
  if (!existsSync(agentsDir)) {
    return {
      content: buildClaudeMd([], []),
      agentCount: 0,
      agentFiles: [],
    };
  }

  const entries = await readdir(agentsDir);
  const agentFiles = entries
    .filter((f) => f.endsWith(".agent.md"))
    .sort();

  const sections: string[] = [];

  for (const filename of agentFiles) {
    const filePath = join(agentsDir, filename);
    try {
      const content = await readFile(filePath, "utf-8");
      const agentName = deriveAgentName(filename);
      sections.push(formatAgentSection(agentName, filename, content));
    } catch {
      /* skip unreadable agent files */
    }
  }

  return {
    content: buildClaudeMd(sections, agentFiles),
    agentCount: sections.length,
    agentFiles,
  };
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function deriveAgentName(filename: string): string {
  return basename(filename, ".agent.md")
    .replace(/^audit-/, "")
    .split("-")
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(" ");
}

function formatAgentSection(agentName: string, filename: string, content: string): string {
  // Strip YAML frontmatter (chatagent format uses ---…--- header)
  const withoutFrontmatter = content.replace(/^---[\s\S]*?---\n/, "").trim();

  return [
    `## Agent: ${agentName}`,
    `> Source: \`.github/agents/${filename}\``,
    "",
    withoutFrontmatter,
  ].join("\n");
}

function buildClaudeMd(sections: string[], agentFiles: string[]): string {
  const agentList = agentFiles
    .map((f) => `- \`${f}\``)
    .join("\n");

  const header = [
    "# Inspectra — Claude Code Reference",
    "",
    "> **Auto-generated** by `inspectra_generate_claude_md`. Do not edit manually.",
    "> Re-run the tool after adding or modifying agent files.",
    "",
    "## Overview",
    "",
    "Inspectra is a multi-agent code audit system. Each agent specialises in one audit domain.",
    "To run an audit, invoke the `audit-orchestrator` agent with a target path.",
    "",
    "## Available Agents",
    "",
    agentList || "_No agents found._",
    "",
    "---",
    "",
  ].join("\n");

  return [header, ...sections].join("\n\n");
}
