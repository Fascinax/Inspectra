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
    "Inspectra is a multi-agent code audit system with 11 audit domains.",
    "Each domain agent runs a two-phase hybrid audit: tool scan (deterministic, high confidence) + LLM exploration (deeper analysis, moderate confidence).",
    "",
    "## How to Run an Audit",
    "",
    "Use the Inspectra MCP tools directly. The typical workflow is:",
    "",
    "1. **Full audit** — Run each domain tool against the project, collect findings, then call `inspectra_merge_domain_reports` to produce a scored report.",
    "2. **Targeted audit** — Run only the tools for the domain(s) you care about.",
    "3. **PR audit** — Run tools only on changed files to detect regressions.",
    "",
    "## MCP Tools",
    "",
    "All tools are prefixed `inspectra_`. Call them by name:",
    "",
    "| Tool | Domain | Purpose |",
    "|------|--------|---------|",
    "| `inspectra_scan_secrets` | Security | Detect hardcoded secrets |",
    "| `inspectra_check_deps_vulns` | Security | npm audit for vulnerabilities |",
    "| `inspectra_run_semgrep` | Security | Semgrep static analysis |",
    "| `inspectra_check_maven_deps` | Security | Maven dependency vulnerabilities |",
    "| `inspectra_parse_coverage` | Tests | Parse coverage reports |",
    "| `inspectra_parse_test_results` | Tests | Parse JUnit XML results |",
    "| `inspectra_detect_missing_tests` | Tests | Find untested source files |",
    "| `inspectra_parse_playwright_report` | Tests | Parse Playwright HTML reports |",
    "| `inspectra_detect_flaky_tests` | Tests | Detect flaky tests from JUnit |",
    "| `inspectra_check_test_quality` | Tests | Check test assertion quality |",
    "| `inspectra_check_layering` | Architecture | Verify layer dependencies |",
    "| `inspectra_analyze_dependencies` | Architecture | Analyze dependency health |",
    "| `inspectra_detect_circular_deps` | Architecture | Detect circular imports |",
    "| `inspectra_check_naming` | Conventions | Verify naming patterns |",
    "| `inspectra_check_file_lengths` | Conventions | Flag long files |",
    "| `inspectra_check_todos` | Conventions | Find TODO/FIXME markers |",
    "| `inspectra_parse_lint_output` | Conventions | Parse ESLint/Checkstyle output |",
    "| `inspectra_detect_dry_violations` | Conventions | Detect code duplication |",
    "| `inspectra_analyze_bundle_size` | Performance | Analyze build bundle size |",
    "| `inspectra_check_build_timings` | Performance | Check build performance |",
    "| `inspectra_detect_runtime_metrics` | Performance | Detect runtime anti-patterns |",
    "| `inspectra_check_readme_completeness` | Documentation | Check README sections |",
    "| `inspectra_check_adr_presence` | Documentation | Check for ADR docs |",
    "| `inspectra_detect_doc_code_drift` | Documentation | Detect stale docs |",
    "| `inspectra_detect_env_example_drift` | Documentation | Check .env.example drift |",
    "| `inspectra_analyze_complexity` | Tech Debt | Cyclomatic complexity |",
    "| `inspectra_age_todos` | Tech Debt | Age stale TODOs |",
    "| `inspectra_check_dependency_staleness` | Tech Debt | Find outdated deps |",
    "| `inspectra_check_a11y_templates` | Accessibility | Detect a11y issues in templates |",
    "| `inspectra_check_rest_conventions` | API Design | REST naming & versioning |",
    "| `inspectra_check_observability` | Observability | Missing logging/tracing |",
    "| `inspectra_check_i18n` | i18n | Hardcoded strings, missing i18n |",
    "| `inspectra_merge_domain_reports` | Orchestrator | Merge & score reports |",
    "| `inspectra_score_findings` | Orchestrator | Compute domain score |",
    "| `inspectra_render_html` | Report | HTML report (Obsidian theme) |",
    "| `inspectra_render_pdf` | Report | PDF export |",
    "| `inspectra_render_trend` | Report | Score trend over time |",
    "| `inspectra_compare_reports` | Report | Diff two reports |",
    "",
    "## Scoring Model",
    "",
    "Domain weights (re-normalized at runtime based on audited domains):",
    "security 24%, tests 20%, architecture 16%, conventions 12%, performance 10%, documentation 8%, tech-debt 10%, accessibility 8%, api-design 7%, observability 6%, i18n 5%.",
    "",
    "Grades: A (90+), B (75+), C (60+), D (40+), F (<40).",
    "",
    "## Finding Contract",
    "",
    "Every finding has: `id` (e.g. SEC-001), `severity` (critical/high/medium/low/info), `domain`, `rule`, `confidence` (0.0-1.0), `source` (tool or llm), `evidence` (file paths).",
    "- Tool findings: IDs 001-499, confidence >= 0.8",
    "- LLM findings: IDs 501+, confidence <= 0.7",
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
