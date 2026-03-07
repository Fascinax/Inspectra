#!/usr/bin/env node

/**
 * Inspectra CLI — audit agent installer.
 *
 * Commands:
 *   inspectra setup              Register MCP server + install agents globally in VS Code (zero project footprint)
 *   inspectra setup --claude     Generate CLAUDE.md + .mcp.json for Claude Code in the current directory
 *   inspectra setup --codex      Generate AGENTS.md + .codex/config.toml for OpenAI Codex in the current directory
 *
 * Note: CLAUDE.md and AGENTS.md are generated from hardcoded templates here, not from the repo root files.
 * Keep writeTargetClaudeMd() and writeTargetAgentsMd() in sync with CLAUDE.md / AGENTS.md.
 *   inspectra init <project>     Symlink agents into a project (gitignored) + .vscode/mcp.json
 *   inspectra init <project> --copy   Copy agents into a project (commits with the repo)
 */

import {
  copyFileSync, mkdirSync, readdirSync, existsSync,
  readFileSync, writeFileSync, symlinkSync, lstatSync, appendFileSync,
} from "node:fs";
import { resolve, join, dirname, relative } from "node:path";
import { fileURLToPath } from "node:url";
import { homedir, platform } from "node:os";

const __dirname = dirname(fileURLToPath(import.meta.url));
const INSPECTRA_ROOT = resolve(__dirname, "..");
const MCP_SERVER_PATH = join(INSPECTRA_ROOT, "mcp", "dist", "index.js");

const AGENT_ASSETS = [
  { src: ".github/agents", glob: "*.agent.md" },
  { src: ".github/prompts", glob: "*.prompt.md" },
];

const DATA_ASSETS = [
  { src: "policies", glob: "*" },
  { src: "schemas", glob: "*.schema.json" },
];

// ─── Helpers ────────────────────────────────────────────────────────────────

function listFiles(srcDir, pattern) {
  if (!existsSync(srcDir)) return [];
  const regex = new RegExp("^" + pattern.replace(/\./g, "\\.").replace(/\*/g, ".*") + "$");
  const files = [];
  for (const entry of readdirSync(srcDir, { withFileTypes: true })) {
    if (entry.isFile() && regex.test(entry.name)) {
      files.push(entry.name);
    } else if (entry.isDirectory()) {
      for (const sub of listFiles(join(srcDir, entry.name), pattern)) {
        files.push(join(entry.name, sub));
      }
    }
  }
  return files;
}

function copyDir(srcDir, destDir, pattern) {
  if (!existsSync(srcDir)) return { total: 0, updated: 0, unchanged: 0 };
  mkdirSync(destDir, { recursive: true });
  let total = 0, updated = 0, unchanged = 0;
  for (const file of listFiles(srcDir, pattern)) {
    const srcFile = join(srcDir, file);
    const destFile = join(destDir, file);
    mkdirSync(dirname(destFile), { recursive: true });
    const srcContent = readFileSync(srcFile);
    const isNew = !existsSync(destFile);
    const isDifferent = isNew || !readFileSync(destFile).equals(srcContent);
    if (isDifferent) {
      copyFileSync(srcFile, destFile);
      console.log(`  ${isNew ? "✦ new  " : "↺ updated"} ${destFile}`);
      updated++;
    } else {
      console.log(`  · unchanged ${destFile}`);
      unchanged++;
    }
    total++;
  }
  return { total, updated, unchanged };
}

function symlinkDir(srcDir, destDir, pattern, projectRoot) {
  if (!existsSync(srcDir)) return { count: 0, gitignoreEntries: [] };

  const destParent = dirname(destDir);
  mkdirSync(destParent, { recursive: true });
  const gitignoreEntries = [];

  // ── Strategy 1: directory junction (Windows, no Developer Mode required) ──
  // Junctions work on any Windows without elevation. Target must be absolute.
  if (!existsSync(destDir)) {
    try {
      symlinkSync(srcDir, destDir, "junction");
      const files = listFiles(srcDir, pattern);
      console.log(`  ↗ ${destDir}/ (junction → ${files.length} files)`);
      gitignoreEntries.push("/" + relative(projectRoot, destDir).replace(/\\/g, "/") + "/");
      return { count: files.length, gitignoreEntries };
    } catch {
      // Junction failed (e.g. cross-device) — fall through to per-file symlinks
    }
  }

  // ── Strategy 2: per-file symlinks (requires Developer Mode on Windows) ──
  mkdirSync(destDir, { recursive: true });
  let count = 0;
  for (const file of listFiles(srcDir, pattern)) {
    const srcFile = join(srcDir, file);
    const destFile = join(destDir, file);
    mkdirSync(dirname(destFile), { recursive: true });

    if (existsSync(destFile)) {
      try { if (lstatSync(destFile).isSymbolicLink()) { count++; continue; } } catch { /* overwrite */ }
    }

    const relTarget = relative(dirname(destFile), srcFile);
    try {
      symlinkSync(relTarget, destFile, "file");
      console.log(`  ↗ ${destFile} → ${relTarget}`);
    } catch (err) {
      if (err.code === "EPERM") {
        // ── Strategy 3: copy (last resort — gitignored via entry below) ──
        copyFileSync(srcFile, destFile);
        console.log(`  ✓ ${destFile} (copied — enable Windows Developer Mode for symlinks)`);
      } else {
        throw err;
      }
    }
    count++;
    gitignoreEntries.push("/" + relative(projectRoot, destFile).replace(/\\/g, "/"));
  }
  return { count, gitignoreEntries };
}

function ensureGitignoreEntries(projectRoot, entries) {
  if (entries.length === 0) return;
  const gitignorePath = join(projectRoot, ".gitignore");
  let content = "";
  if (existsSync(gitignorePath)) {
    content = readFileSync(gitignorePath, "utf-8");
  }
  const missing = entries.filter((e) => !content.includes(e));
  if (missing.length === 0) return;

  const block = "\n# Inspectra agents (linked, not committed)\n" + missing.join("\n") + "\n";
  appendFileSync(gitignorePath, block, "utf-8");
  console.log(`  ✓ .gitignore updated (${missing.length} entries)`);
}

function getVSCodeUserDir() {
  const os = platform();
  if (os === "win32") return join(process.env.APPDATA ?? homedir(), "Code", "User");
  if (os === "darwin") return join(homedir(), "Library", "Application Support", "Code", "User");
  return join(homedir(), ".config", "Code", "User");
}

function getVSCodeSettingsPath() {
  return join(getVSCodeUserDir(), "settings.json");
}

function writeMcpJson(targetDir) {
  const vscodeMcpPath = join(targetDir, ".vscode", "mcp.json");
  mkdirSync(join(targetDir, ".vscode"), { recursive: true });
  const mcpConfig = {
    servers: {
      inspectra: {
        type: "stdio",
        command: "node",
        args: [MCP_SERVER_PATH],
      },
    },
  };
  writeFileSync(vscodeMcpPath, JSON.stringify(mcpConfig, null, 2) + "\n", "utf-8");
  console.log(`  ✓ ${vscodeMcpPath}`);
  return 1;
}

function writeClaudeMcpJson(targetDir) {
  const mcpPath = join(targetDir, ".mcp.json");
  const mcpConfig = {
    mcpServers: {
      inspectra: {
        command: "node",
        args: [MCP_SERVER_PATH],
      },
    },
  };
  writeFileSync(mcpPath, JSON.stringify(mcpConfig, null, 2) + "\n", "utf-8");
  console.log(`  ✓ ${mcpPath}`);
  return 1;
}

function writeTargetClaudeMd(targetDir) {
  const claudeMdPath = join(targetDir, "CLAUDE.md");
  const content = `# Project Audit — Inspectra

> Auto-generated by \`inspectra setup --claude\`. Customise as needed.

## Inspectra MCP Tools

This project is configured to use Inspectra, a multi-agent code audit system.
The MCP server is registered in \`.mcp.json\` and exposes 42 audit tools.

## How to Run an Audit

1. **Full audit** — Run domain tools against this project, then merge results:
   - Call \`inspectra_scan_secrets\`, \`inspectra_check_deps_vulns\`, etc. for each domain
   - Call \`inspectra_merge_domain_reports\` to produce a scored report

2. **Quick single-domain audit** — Run only one domain's tools:
   - Security: \`inspectra_scan_secrets\`, \`inspectra_check_deps_vulns\`
   - Tests: \`inspectra_parse_coverage\`, \`inspectra_detect_missing_tests\`
   - Architecture: \`inspectra_check_layering\`, \`inspectra_detect_circular_deps\`
   - Conventions: \`inspectra_check_naming\`, \`inspectra_check_file_lengths\`
   - Performance: \`inspectra_analyze_bundle_size\`, \`inspectra_detect_runtime_metrics\`
   - Documentation: \`inspectra_check_readme_completeness\`, \`inspectra_check_adr_presence\`
   - Tech Debt: \`inspectra_analyze_complexity\`, \`inspectra_check_dependency_staleness\`
   - Accessibility: \`inspectra_check_a11y_templates\`
   - API Design: \`inspectra_check_rest_conventions\`
   - Observability: \`inspectra_check_observability\`
   - i18n: \`inspectra_check_i18n\`
   - UX Consistency: \`inspectra_check_ux_consistency\`

3. **Score findings** — Call \`inspectra_score_findings\` with any list of findings.

4. **Generate reports** — \`inspectra_render_html\`, \`inspectra_render_pdf\`, or \`inspectra_compare_reports\`.

## Scoring

Domain weights: security 24%, tests 20%, architecture 16%, conventions 12%, performance 10%, documentation 8%, tech-debt 10%, accessibility 8%, api-design 7%, observability 6%, i18n 5%, ux-consistency 6%.
Grades: A (90+), B (75+), C (60+), D (40+), F (<40).

## Finding Format

Every finding: \`id\` (SEC-001), \`severity\` (critical/high/medium/low/info), \`domain\`, \`rule\`, \`confidence\` (0.0–1.0), \`source\` (tool/llm), \`evidence\` (file paths).

## Pagination

All finding tools return paginated responses (default page size: 20). Every response includes \`has_more\` and \`next_offset\`. **Always paginate when \`has_more: true\`** — call the tool again with the returned \`next_offset\` until \`has_more: false\`, then merge all pages. Skipping pagination silently drops findings beyond the first page.
`;
  writeFileSync(claudeMdPath, content, "utf-8");
  console.log(`  ✓ ${claudeMdPath}`);
  return 1;
}

function writeCodexConfigToml(targetDir) {
  const codexDir = join(targetDir, ".codex");
  mkdirSync(codexDir, { recursive: true });
  const configPath = join(codexDir, "config.toml");
  const serverPath = MCP_SERVER_PATH.replace(/\\/g, "/");
  const content = `# Inspectra MCP server — auto-generated by \`inspectra setup --codex\`
[mcp_servers.inspectra]
command = "node"
args = ["${serverPath}"]
`;
  writeFileSync(configPath, content, "utf-8");
  console.log(`  ✓ ${configPath}`);
  return 1;
}

function writeTargetAgentsMd(targetDir) {
  const agentsMdPath = join(targetDir, "AGENTS.md");
  const content = `# Project Audit — Inspectra

> Auto-generated by \`inspectra setup --codex\`. Customise as needed.

## Inspectra MCP Tools

This project is configured to use Inspectra, a multi-agent code audit system.
The MCP server is registered in \`.codex/config.toml\` and exposes 42 audit tools.
All tool names are prefixed \`inspectra_\`.

## How to Run an Audit

1. **Full audit** — Run domain tools against this project, then merge results:
   - Call \`inspectra_scan_secrets\`, \`inspectra_check_deps_vulns\`, etc. for each domain
   - Call \`inspectra_merge_domain_reports\` to produce a scored report

2. **Quick single-domain audit** — Run only one domain's tools:
   - Security: \`inspectra_scan_secrets\`, \`inspectra_check_deps_vulns\`, \`inspectra_run_semgrep\`
   - Tests: \`inspectra_parse_coverage\`, \`inspectra_detect_missing_tests\`, \`inspectra_check_test_quality\`
   - Architecture: \`inspectra_check_layering\`, \`inspectra_detect_circular_deps\`
   - Conventions: \`inspectra_check_naming\`, \`inspectra_check_file_lengths\`, \`inspectra_check_todos\`
   - Performance: \`inspectra_analyze_bundle_size\`, \`inspectra_detect_runtime_metrics\`
   - Documentation: \`inspectra_check_readme_completeness\`, \`inspectra_check_adr_presence\`
   - Tech Debt: \`inspectra_analyze_complexity\`, \`inspectra_check_dependency_staleness\`
   - Accessibility: \`inspectra_check_a11y_templates\`
   - API Design: \`inspectra_check_rest_conventions\`
   - Observability: \`inspectra_check_observability\`
   - i18n: \`inspectra_check_i18n\`
   - UX Consistency: \`inspectra_check_ux_consistency\`

3. **Score findings** — Call \`inspectra_score_findings\` with any list of findings.

4. **Generate reports** — \`inspectra_render_html\`, \`inspectra_render_pdf\`, or \`inspectra_compare_reports\`.

## Scoring

Domain weights (re-normalized at runtime): security 24%, tests 20%, architecture 16%, conventions 12%, performance 10%, documentation 8%, tech-debt 10%, accessibility 8%, api-design 7%, observability 6%, i18n 5%, ux-consistency 6%.
Grades: A (90+), B (75+), C (60+), D (40+), F (<40).

## Finding Format

Every finding: \`id\` (e.g. SEC-001), \`severity\` (critical/high/medium/low/info), \`domain\`, \`rule\`, \`confidence\` (0.0–1.0), \`source\` (tool/llm), \`evidence\` (file paths).
- Tool findings: IDs 001–499, confidence >= 0.8
- LLM findings: IDs 501+, confidence <= 0.7

## Pagination

All finding tools return paginated responses (default page size: 20). Every response includes \`has_more\` and \`next_offset\`. **Always paginate when \`has_more: true\`** — call the tool again with the returned \`next_offset\` until \`has_more: false\`, then merge all pages. Skipping pagination silently drops findings beyond the first page.
`;
  writeFileSync(agentsMdPath, content, "utf-8");
  console.log(`  ✓ ${agentsMdPath}`);
  return 1;
}

// ─── setup ──────────────────────────────────────────────────────────────────

function cmdSetup({ claude = false, codex = false } = {}) {
  if (!existsSync(MCP_SERVER_PATH)) {
    console.error(`\n✗ MCP server not built. Run first:\n  npm run build\n`);
    process.exit(1);
  }

  if (claude) {
    return cmdSetupClaude();
  }
  if (codex) {
    return cmdSetupCodex();
  }

  console.log("\n╔══════════════════════════════════════╗");
  console.log("║     INSPECTRA — Global Setup         ║");
  console.log("╚══════════════════════════════════════╝\n");

  // 1. Register MCP server in VS Code user settings
  const settingsPath = getVSCodeSettingsPath();
  mkdirSync(dirname(settingsPath), { recursive: true });

  let settings = {};
  if (existsSync(settingsPath)) {
    try { settings = JSON.parse(readFileSync(settingsPath, "utf-8")); } catch { /* keep empty */ }
  }

  settings.mcp ??= {};
  settings.mcp.servers ??= {};
  settings.mcp.servers.inspectra = {
    type: "stdio",
    command: "node",
    args: [MCP_SERVER_PATH],
  };

  writeFileSync(settingsPath, JSON.stringify(settings, null, 2) + "\n", "utf-8");
  console.log(`  ✓ MCP server registered in VS Code user settings`);
  console.log(`    ${settingsPath}`);

  // 2. Copy agents + prompts to VS Code user prompts directory
  const userPromptsDir = join(getVSCodeUserDir(), "prompts");
  mkdirSync(userPromptsDir, { recursive: true });

  let total = 0, updated = 0, unchanged = 0;
  for (const asset of AGENT_ASSETS) {
    const srcDir = join(INSPECTRA_ROOT, asset.src);
    const result = copyDir(srcDir, userPromptsDir, asset.glob);
    total += result.total;
    updated += result.updated;
    unchanged += result.unchanged;
  }

  console.log(`\n  ${updated > 0 ? "↺" : "✓"} ${total} agent/prompt files → ${userPromptsDir}`);
  console.log(`    ${updated} updated, ${unchanged} already up-to-date`);

  if (updated === 0) {
    console.log(`\n✅ Inspectra is already up-to-date. No changes were made to agent files.`);
  } else {
    console.log(`\n✅ Inspectra updated — ${updated} file(s) changed.`);
    console.log(`   Reload the MCP configuration in VS Code if the server was already running:`);
    console.log(`   Command Palette → MCP: List Servers → restart inspectra`);
  }
  console.log(`\n   To use: open any project → Copilot Chat → select audit-orchestrator → /audit\n`);
}

// ─── setup --claude ─────────────────────────────────────────────────────────

function cmdSetupClaude() {
  const cwd = process.cwd();

  console.log("\n╔══════════════════════════════════════╗");
  console.log("║   INSPECTRA — Claude Code Setup      ║");
  console.log("╚══════════════════════════════════════╝\n");

  let total = 0;

  // 1. Write .mcp.json (Claude Code format)
  total += writeClaudeMcpJson(cwd);

  // 2. Write CLAUDE.md with audit instructions
  total += writeTargetClaudeMd(cwd);

  // 3. Copy policies and schemas for local reference
  for (const asset of DATA_ASSETS) {
    const srcDir = join(INSPECTRA_ROOT, asset.src);
    const destDir = join(cwd, asset.src);
    const result = copyDir(srcDir, destDir, asset.glob);
    total += result.total;
  }

  console.log(`\nDone — ${total} files written.`);
  console.log("\n  Claude Code will auto-detect .mcp.json and connect to the Inspectra MCP server.");
  console.log("  CLAUDE.md provides audit instructions as project context.");
  console.log("\n  To audit: open this project in Claude Code and ask to run an audit.\n");
}

// ─── setup --codex ──────────────────────────────────────────────────────────

function cmdSetupCodex() {
  const cwd = process.cwd();

  console.log("\n╔══════════════════════════════════════╗");
  console.log("║   INSPECTRA — Codex Setup            ║");
  console.log("╚══════════════════════════════════════╝\n");

  let total = 0;

  // 1. Write .codex/config.toml
  total += writeCodexConfigToml(cwd);

  // 2. Write AGENTS.md with audit instructions
  total += writeTargetAgentsMd(cwd);

  // 3. Copy policies and schemas for local reference
  for (const asset of DATA_ASSETS) {
    const srcDir = join(INSPECTRA_ROOT, asset.src);
    const destDir = join(cwd, asset.src);
    const result = copyDir(srcDir, destDir, asset.glob);
    total += result.total;
  }

  console.log(`\nDone — ${total} files written.`);
  console.log("\n  Codex will read AGENTS.md for project context and .codex/config.toml for MCP.");
  console.log("  Run: codex \"Run a full Inspectra audit on this project.\"");
  console.log("  Or use /mcp in the Codex TUI to verify the server is connected.\n");
}

// ─── init (symlink mode — default) ──────────────────────────────────────────

function cmdInitSymlink(targetArg, { claude = false, codex = false } = {}) {
  const target = resolve(targetArg);
  if (!existsSync(target)) {
    console.error(`Error: target path does not exist: ${target}`);
    process.exit(1);
  }

  console.log(`\nInspectra Init (symlink) → ${target}\n`);

  let total = 0;
  const allGitignoreEntries = [];

  // Symlink agents + prompts
  for (const asset of AGENT_ASSETS) {
    const srcDir = join(INSPECTRA_ROOT, asset.src);
    const destDir = join(target, asset.src);
    const { count, gitignoreEntries } = symlinkDir(srcDir, destDir, asset.glob, target);
    total += count;
    allGitignoreEntries.push(...gitignoreEntries);
  }

  // Copy data files (policies/schemas are small and project-specific)
  for (const asset of DATA_ASSETS) {
    const srcDir = join(INSPECTRA_ROOT, asset.src);
    const destDir = join(target, asset.src);
    const result = copyDir(srcDir, destDir, asset.glob);
    total += result.total;
  }

  // Write MCP config (format depends on runtime)
  if (claude) {
    total += writeClaudeMcpJson(target);
    total += writeTargetClaudeMd(target);
  } else if (codex) {
    total += writeCodexConfigToml(target);
    total += writeTargetAgentsMd(target);
  } else {
    total += writeMcpJson(target);
  }

  // Update .gitignore with symlinked paths
  ensureGitignoreEntries(target, allGitignoreEntries);

  console.log(`\nDone — ${total} files linked/written.`);
  if (claude) {
    console.log("Claude Code will auto-detect .mcp.json and connect to the Inspectra MCP server.");
  } else if (codex) {
    console.log("Codex will read AGENTS.md and .codex/config.toml for MCP.");
  } else {
    console.log("Agents are gitignored — your repo stays clean.");
    console.log("Open the project in VS Code: agents appear in Copilot dropdown.");
  }
  console.log("");
}

// ─── init --copy (legacy copy mode) ─────────────────────────────────────────

function cmdInitCopy(targetArg, { claude = false, codex = false } = {}) {
  const target = resolve(targetArg);
  if (!existsSync(target)) {
    console.error(`Error: target path does not exist: ${target}`);
    process.exit(1);
  }

  console.log(`\nInspectra Init (copy) → ${target}\n`);

  let total = 0, updated = 0, unchanged = 0;
  for (const asset of [...AGENT_ASSETS, ...DATA_ASSETS]) {
    const srcDir = join(INSPECTRA_ROOT, asset.src);
    const destDir = join(target, asset.src);
    const result = copyDir(srcDir, destDir, asset.glob);
    total += result.total;
    updated += result.updated;
    unchanged += result.unchanged;
  }

  if (claude) {
    total += writeClaudeMcpJson(target);
    total += writeTargetClaudeMd(target);
  } else if (codex) {
    total += writeCodexConfigToml(target);
    total += writeTargetAgentsMd(target);
  } else {
    total += writeMcpJson(target);
  }

  console.log(`\nDone — ${total} files copied (${updated} updated, ${unchanged} unchanged).`);
  if (claude) {
    console.log("Claude Code will auto-detect .mcp.json and connect to the Inspectra MCP server.\n");
  } else if (codex) {
    console.log("Codex will read AGENTS.md and .codex/config.toml for MCP.\n");
  } else {
    console.log("Files are committed with your repo. Open in VS Code to use.\n");
  }
}

// ─── doctor ──────────────────────────────────────────────────────────────────

function cmdDoctor() {
  console.log("\n╔══════════════════════════════════════╗");
  console.log("║     INSPECTRA — Doctor               ║");
  console.log("╚══════════════════════════════════════╝\n");

  let allOk = true;

  function check(label, ok, hint) {
    if (ok) {
      console.log(`  ✓ ${label}`);
    } else {
      console.log(`  ✗ ${label}`);
      if (hint) console.log(`    → ${hint}`);
      allOk = false;
    }
  }

  // 1. Node version
  const [major] = process.versions.node.split(".").map(Number);
  check(
    `Node.js ${process.versions.node}`,
    major >= 20,
    "Inspectra requires Node.js 20+. Install from https://nodejs.org",
  );

  // 2. MCP server built
  check(
    `MCP server built  (${MCP_SERVER_PATH})`,
    existsSync(MCP_SERVER_PATH),
    "Run: npm run build",
  );

  // 3. VS Code user settings — MCP server registered
  const settingsPath = getVSCodeSettingsPath();
  let vsCodeOk = false;
  if (existsSync(settingsPath)) {
    try {
      const settings = JSON.parse(readFileSync(settingsPath, "utf-8"));
      vsCodeOk = !!(settings?.mcp?.servers?.inspectra);
    } catch { /* ignore */ }
  }
  check(
    "VS Code MCP entry  (mcp.servers.inspectra)",
    vsCodeOk,
    "Run: inspectra setup",
  );

  // 4. Agent files
  const agentsDir = join(INSPECTRA_ROOT, ".github", "agents");
  const agentFiles = existsSync(agentsDir)
    ? readdirSync(agentsDir).filter((f) => f.endsWith(".agent.md"))
    : [];
  check(
    `Agent files  (${agentFiles.length} found in .github/agents/)`,
    agentFiles.length > 0,
    "Agent files are missing. Re-clone the repository or run: inspectra setup",
  );

  // 5. policies directory
  const policiesDir = join(INSPECTRA_ROOT, "policies");
  check(
    `Policies directory  (${policiesDir})`,
    existsSync(policiesDir),
    "Policies directory is missing. Re-clone the repository.",
  );

  // 6. schemas directory
  const schemasDir = join(INSPECTRA_ROOT, "schemas");
  check(
    `Schemas directory  (${schemasDir})`,
    existsSync(schemasDir),
    "Schemas directory is missing. Re-clone the repository.",
  );

  // 7. Claude Code — .mcp.json in current dir (optional, only warn if present but broken)
  const claudeMcpPath = join(process.cwd(), ".mcp.json");
  if (existsSync(claudeMcpPath)) {
    let claudeOk = false;
    try {
      const parsed = JSON.parse(readFileSync(claudeMcpPath, "utf-8"));
      claudeOk = !!(parsed?.mcpServers?.inspectra);
    } catch { /* invalid JSON */ }
    check(
      `Claude Code .mcp.json  (mcpServers.inspectra)`,
      claudeOk,
      "Run: inspectra setup --claude  to regenerate .mcp.json",
    );
  }

  // 8. Codex — .codex/config.toml in current dir (optional, only warn if present but broken)
  const codexConfigPath = join(process.cwd(), ".codex", "config.toml");
  if (existsSync(codexConfigPath)) {
    const tomlContent = readFileSync(codexConfigPath, "utf-8");
    check(
      `Codex .codex/config.toml  (mcp_servers.inspectra)`,
      tomlContent.includes("[mcp_servers.inspectra]"),
      "Run: inspectra setup --codex  to regenerate .codex/config.toml",
    );
  }

  console.log("");
  if (allOk) {
    console.log("  All checks passed — Inspectra is ready to use.\n");
  } else {
    console.log("  Some checks failed. Follow the hints above to fix them.\n");
    process.exit(1);
  }
}

// ─── help ────────────────────────────────────────────────────────────────────

function printHelp() {
  console.log(`
Inspectra — multi-agent code audit system

Commands:
  inspectra setup                    Install agents + MCP globally in VS Code (zero project footprint)
  inspectra setup --claude           Generate CLAUDE.md + .mcp.json in current dir for Claude Code
  inspectra setup --codex            Generate AGENTS.md + .codex/config.toml in current dir for Codex
  inspectra init <project>           Symlink agents into a project (gitignored) + .vscode/mcp.json
  inspectra init <project> --copy    Copy agents into a project (committed with the repo)
  inspectra init <project> --claude  Set up project for Claude Code
  inspectra init <project> --codex   Set up project for OpenAI Codex
  inspectra doctor                   Check environment prerequisites and configuration

Typical workflows:

  VS Code + Copilot (recommended — nothing in your projects):
    inspectra setup

  Claude Code:
    cd /my-project && inspectra setup --claude

  OpenAI Codex:
    cd /my-project && inspectra setup --codex

  Per-project symlinks (gitignored):
    inspectra init /my-project
    inspectra init /my-project --claude   # Claude Code variant
    inspectra init /my-project --codex    # Codex variant

  Per-project copies (committed):
    inspectra init /my-project --copy
`);
}

// ─── Main ───────────────────────────────────────────────────────────────────

const args = process.argv.slice(2);
const cmd = args[0];
const hasFlag = (flag) => args.includes(flag);
const positional = args.filter((a) => !a.startsWith("-"));

if (!cmd || cmd === "--help" || cmd === "-h") {
  printHelp();
} else if (cmd === "setup") {
  cmdSetup({ claude: hasFlag("--claude"), codex: hasFlag("--codex") });
} else if (cmd === "doctor") {
  cmdDoctor();
} else if (cmd === "init") {
  const target = positional[1];
  if (!target) { console.error("Usage: inspectra init <project-path> [--copy] [--claude] [--codex]"); process.exit(1); }
  const runtimeFlags = { claude: hasFlag("--claude"), codex: hasFlag("--codex") };
  if (hasFlag("--copy")) {
    cmdInitCopy(target, runtimeFlags);
  } else {
    cmdInitSymlink(target, runtimeFlags);
  }
} else {
  // backward compat: inspectra <path> treated as init
  cmdInitSymlink(cmd);
}
