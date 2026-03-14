import { readdir } from "node:fs/promises";
import { existsSync } from "node:fs";
import { join } from "node:path";

export interface AdapterDocumentResult {
  content: string;
  referenceCount: number;
  includedFiles: string[];
}

export async function generateClaudeMd(projectDir: string): Promise<AdapterDocumentResult> {
  const promptFiles = await listPromptFiles(projectDir);

  return {
    content: buildAdapterDoc({
      title: "# Inspectra — Claude Code Reference",
      introLines: [
        "> **Auto-generated** by `inspectra_generate_claude_md`. Do not edit manually.",
        "> Re-run the tool after adding or modifying prompt workflow files.",
      ],
      promptFiles,
      includeMcpHint: false,
    }),
    referenceCount: promptFiles.length,
    includedFiles: promptFiles,
  };
}

export async function generateCodexAgentsMd(projectDir: string): Promise<AdapterDocumentResult> {
  const promptFiles = await listPromptFiles(projectDir);

  return {
    content: buildAdapterDoc({
      title: "# Inspectra — Codex Project Instructions",
      introLines: [
        "> **Auto-generated** by `inspectra_generate_codex_agents_md`. Do not edit manually.",
        "> Re-run the tool after adding or modifying prompt workflow files.",
      ],
      promptFiles,
      includeMcpHint: true,
    }),
    referenceCount: promptFiles.length,
    includedFiles: promptFiles,
  };
}

async function listPromptFiles(projectDir: string): Promise<string[]> {
  const promptsDir = join(projectDir, ".github", "prompts");
  if (!existsSync(promptsDir)) {
    return [];
  }

  const entries = await readdir(promptsDir);
  return entries.filter((entry) => entry.endsWith(".prompt.md")).sort();
}

function buildAdapterDoc({
  title,
  introLines,
  promptFiles,
  includeMcpHint,
}: {
  title: string;
  introLines: string[];
  promptFiles: string[];
  includeMcpHint: boolean;
}): string {
  const promptList = promptFiles.length > 0
    ? promptFiles.map((file) => `- \`${file}\``).join("\n")
    : "_No prompt shortcuts found._";

  const workflowIntro = includeMcpHint
    ? "Use the Inspectra MCP tools and verify the connection with `/mcp` in the TUI when needed."
    : "Use the Inspectra MCP tools directly from Claude Code."
;

  return [
    title,
    "",
    ...introLines,
    "",
    "## Overview",
    "",
    "Inspectra is a hybrid code audit system with 12 audit domains.",
    "The default workflow runs deterministic MCP tools first, then uses conditional hotspot exploration before scoring and merging findings.",
    "",
    "## Workflow Overview",
    "",
    "1. Run the relevant MCP tool groups for the requested audit scope.",
    "2. Paginate until each tool returns `has_more: false`.",
    "3. Use hotspot exploration only on files with clustered findings.",
    "4. Merge domain reports with `inspectra_merge_domain_reports`.",
    "5. Render or export the final report as needed.",
    "",
    "## Prompt Shortcuts",
    "",
    promptList,
    "",
    "## How to Run an Audit",
    "",
    workflowIntro,
    "",
    "1. **Full audit** — Run each domain tool against the project, then merge reports.",
    "2. **Targeted audit** — Run only the tools for the requested domain or domains.",
    "3. **PR audit** — Run tools only on changed files to detect regressions.",
    "",
    "## MCP Tools",
    "",
    "| Tool | Domain | Purpose |",
    "| ------ | -------- | --------- |",
    "| `inspectra_scan_secrets` | Security | Detect hardcoded secrets |",
    "| `inspectra_check_deps_vulns` | Security | npm audit for vulnerabilities |",
    "| `inspectra_check_layering` | Architecture | Verify layer dependencies |",
    "| `inspectra_check_file_lengths` | Conventions | Flag long files |",
    "| `inspectra_analyze_bundle_size` | Performance | Analyze build bundle size |",
    "| `inspectra_check_readme_completeness` | Documentation | Check README sections |",
    "| `inspectra_analyze_complexity` | Tech Debt | Cyclomatic complexity |",
    "| `inspectra_check_a11y_templates` | Accessibility | Detect a11y issues in templates |",
    "| `inspectra_check_rest_conventions` | API Design | REST naming and versioning |",
    "| `inspectra_check_observability` | Observability | Missing logging and tracing |",
    "| `inspectra_check_i18n` | i18n | Hardcoded strings and missing i18n |",
    "| `inspectra_check_ux_consistency` | UX Consistency | Design system and token drift |",
    "| `inspectra_merge_domain_reports` | Orchestrator | Merge and score reports |",
    "| `inspectra_render_html` | Report | Render HTML report |",
    "",
    "## Scoring Model",
    "",
    "Domain weights (re-normalized at runtime based on audited domains): security 24%, tests 20%, architecture 16%, conventions 12%, performance 10%, documentation 8%, tech-debt 10%, accessibility 8%, api-design 7%, observability 6%, i18n 5%, ux-consistency 6%.",
    "Grades: A (90+), B (75+), C (60+), D (40+), F (<40).",
    "",
    "## Finding Contract",
    "",
    "Every finding must include `id`, `severity`, `domain`, `rule`, `confidence`, `source`, and `evidence`.",
    "- Tool findings: IDs 001-499, confidence >= 0.8",
    "- LLM findings: IDs 501+, confidence <= 0.7",
    "",
    "## Pagination",
    "",
    "All finding tools return paginated responses. Keep fetching until `has_more` is `false`.",
    "",
  ].join("\n");
}
