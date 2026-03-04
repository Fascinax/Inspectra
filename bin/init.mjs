#!/usr/bin/env node

/**
 * Inspectra CLI — audit agent installer.
 *
 * Commands:
 *   inspectra setup              Register MCP server + install agents globally in VS Code (zero project footprint)
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
  if (!existsSync(srcDir)) return 0;
  mkdirSync(destDir, { recursive: true });
  let count = 0;
  for (const file of listFiles(srcDir, pattern)) {
    const destFile = join(destDir, file);
    mkdirSync(dirname(destFile), { recursive: true });
    copyFileSync(join(srcDir, file), destFile);
    count++;
    console.log(`  ✓ ${destFile}`);
  }
  return count;
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

// ─── setup ──────────────────────────────────────────────────────────────────

function cmdSetup() {
  if (!existsSync(MCP_SERVER_PATH)) {
    console.error(`\n✗ MCP server not built. Run first:\n  npm run build\n`);
    process.exit(1);
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

  let agentCount = 0;
  for (const asset of AGENT_ASSETS) {
    const srcDir = join(INSPECTRA_ROOT, asset.src);
    agentCount += copyDir(srcDir, userPromptsDir, asset.glob);
  }

  console.log(`\n  ✓ ${agentCount} agent/prompt files installed to VS Code user directory`);
  console.log(`    ${userPromptsDir}`);

  console.log(`\n✅ Inspectra is globally available in all VS Code projects.`);
  console.log(`   No files are added to your projects.`);
  console.log(`\n   To use: open any project → Copilot Chat → select audit-orchestrator → /audit\n`);
}

// ─── init (symlink mode — default) ──────────────────────────────────────────

function cmdInitSymlink(targetArg) {
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
    total += copyDir(srcDir, destDir, asset.glob);
  }

  // Write .vscode/mcp.json
  total += writeMcpJson(target);

  // Update .gitignore with symlinked paths
  ensureGitignoreEntries(target, allGitignoreEntries);

  console.log(`\nDone — ${total} files linked/written.`);
  console.log("Agents are gitignored — your repo stays clean.");
  console.log("Open the project in VS Code: agents appear in Copilot dropdown.\n");
}

// ─── init --copy (legacy copy mode) ─────────────────────────────────────────

function cmdInitCopy(targetArg) {
  const target = resolve(targetArg);
  if (!existsSync(target)) {
    console.error(`Error: target path does not exist: ${target}`);
    process.exit(1);
  }

  console.log(`\nInspectra Init (copy) → ${target}\n`);

  let total = 0;
  for (const asset of [...AGENT_ASSETS, ...DATA_ASSETS]) {
    const srcDir = join(INSPECTRA_ROOT, asset.src);
    const destDir = join(target, asset.src);
    total += copyDir(srcDir, destDir, asset.glob);
  }

  total += writeMcpJson(target);

  console.log(`\nDone — ${total} files copied.`);
  console.log("Files are committed with your repo. Open in VS Code to use.\n");
}

// ─── help ────────────────────────────────────────────────────────────────────

function printHelp() {
  console.log(`
Inspectra — multi-agent code audit system

Commands:
  inspectra setup                    Install agents + MCP globally in VS Code (zero project footprint)
  inspectra init <project>           Symlink agents into a project (gitignored) + .vscode/mcp.json
  inspectra init <project> --copy    Copy agents into a project (committed with the repo)

Typical workflows:

  Global (recommended — nothing in your projects):
    inspectra setup

  Per-project symlinks (gitignored):
    inspectra init /my-project

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
  cmdSetup();
} else if (cmd === "init") {
  const target = positional[1];
  if (!target) { console.error("Usage: inspectra init <project-path> [--copy]"); process.exit(1); }
  if (hasFlag("--copy")) {
    cmdInitCopy(target);
  } else {
    cmdInitSymlink(target);
  }
} else {
  // backward compat: inspectra <path> treated as init
  cmdInitSymlink(cmd);
}
