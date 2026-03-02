#!/usr/bin/env node

/**
 * Inspectra CLI — global audit agent installer.
 *
 * Commands:
 *   inspectra setup              Register the MCP server in VS Code user settings (run once)
 *   inspectra init <project>     Install agents + .vscode/mcp.json into a target project
 */

import { copyFileSync, mkdirSync, readdirSync, existsSync, readFileSync, writeFileSync } from "node:fs";
import { resolve, join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { homedir, platform } from "node:os";

const __dirname = dirname(fileURLToPath(import.meta.url));
const INSPECTRA_ROOT = resolve(__dirname, "..");
const MCP_SERVER_PATH = join(INSPECTRA_ROOT, "mcp", "dist", "index.js");

const ASSETS = [
  { src: ".github/agents", glob: "*.agent.md" },
  { src: ".github/prompts", glob: "*.prompt.md" },
  { src: ".github", files: ["copilot-instructions.md"] },
  { src: "policies", glob: "*" },
  { src: "schemas", glob: "*.schema.json" },
];

// ─── Helpers ────────────────────────────────────────────────────────────────

function copyDir(srcDir, destDir, pattern) {
  if (!existsSync(srcDir)) return 0;
  mkdirSync(destDir, { recursive: true });
  const regex = new RegExp("^" + pattern.replace(/\./g, "\\.").replace(/\*/g, ".*") + "$");
  let count = 0;
  for (const entry of readdirSync(srcDir, { withFileTypes: true })) {
    if (entry.isFile() && regex.test(entry.name)) {
      copyFileSync(join(srcDir, entry.name), join(destDir, entry.name));
      count++;
      console.log(`  ✓ ${join(destDir, entry.name)}`);
    } else if (entry.isDirectory()) {
      count += copyDir(join(srcDir, entry.name), join(destDir, entry.name), pattern);
    }
  }
  return count;
}

function copyFiles(srcDir, destDir, files) {
  mkdirSync(destDir, { recursive: true });
  let count = 0;
  for (const file of files) {
    const src = join(srcDir, file);
    if (existsSync(src)) {
      copyFileSync(src, join(destDir, file));
      count++;
      console.log(`  ✓ ${join(destDir, file)}`);
    }
  }
  return count;
}

function getVSCodeSettingsPath() {
  const os = platform();
  if (os === "win32") return join(process.env.APPDATA ?? homedir(), "Code", "User", "settings.json");
  if (os === "darwin") return join(homedir(), "Library", "Application Support", "Code", "User", "settings.json");
  return join(homedir(), ".config", "Code", "User", "settings.json");
}

// ─── setup ──────────────────────────────────────────────────────────────────

function cmdSetup() {
  if (!existsSync(MCP_SERVER_PATH)) {
    console.error(`\n✗ MCP server not built. Run first:\n  npm run build\n`);
    process.exit(1);
  }

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

  console.log(`\n✓ MCP server registered in VS Code user settings`);
  console.log(`  ${settingsPath}`);
  console.log(`\nInspectra is now globally available in VS Code.`);
  console.log(`Run "inspectra init <project>" to activate agents in a project.\n`);
}

// ─── init ───────────────────────────────────────────────────────────────────

function cmdInit(targetArg) {
  const target = resolve(targetArg);
  if (!existsSync(target)) {
    console.error(`Error: target path does not exist: ${target}`);
    process.exit(1);
  }

  console.log(`\nInspectra Init → ${target}\n`);

  let total = 0;
  for (const asset of ASSETS) {
    const srcDir = join(INSPECTRA_ROOT, asset.src);
    const destDir = join(target, asset.src);
    if (asset.glob) total += copyDir(srcDir, destDir, asset.glob);
    else if (asset.files) total += copyFiles(srcDir, destDir, asset.files);
  }

  // Write .vscode/mcp.json so the MCP server starts automatically in this project
  const vscodeMcpPath = join(target, ".vscode", "mcp.json");
  mkdirSync(join(target, ".vscode"), { recursive: true });
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
  total++;

  console.log(`\nDone — ${total} files written.`);
  console.log("Open the project in VS Code: agents appear in Copilot dropdown, MCP server starts automatically.\n");
  if (!existsSync(MCP_SERVER_PATH)) {
    console.warn(`⚠ Warning: MCP server not built yet. Run "npm run build" in Inspectra first.\n`);
  }
}

// ─── help ────────────────────────────────────────────────────────────────────

function printHelp() {
  console.log(`
Inspectra — multi-agent code audit system

Commands:
  inspectra setup              Register MCP server in VS Code globally (run once after install)
  inspectra init <project>     Install agents + MCP config into a target project

Typical workflow:
  npm install -g .             Install globally
  inspectra setup              Register MCP server in VS Code (once)
  inspectra init /my-project   Activate agents in a project
`);
}

// ─── Main ───────────────────────────────────────────────────────────────────

const [,, cmd, arg] = process.argv;

if (!cmd || cmd === "--help" || cmd === "-h") {
  printHelp();
} else if (cmd === "setup") {
  cmdSetup();
} else if (cmd === "init") {
  if (!arg) { console.error("Usage: inspectra init <project-path>"); process.exit(1); }
  cmdInit(arg);
} else {
  // backward compat: inspectra <path> treated as init
  cmdInit(cmd);
}
