#!/usr/bin/env node

/**
 * Copies Inspectra agents, prompts, policies, schemas, and copilot-instructions
 * into a target project so the agents appear in VS Code's Copilot dropdown.
 *
 * Usage:
 *   npx inspectra init <target-project-path>
 *   node bin/init.mjs <target-project-path>
 */

import { copyFileSync, mkdirSync, readdirSync, existsSync } from "node:fs";
import { resolve, join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const INSPECTRA_ROOT = resolve(__dirname, "..");

const ASSETS = [
  { src: ".github/agents", glob: "*.agent.md" },
  { src: ".github/prompts", glob: "*.prompt.md" },
  { src: ".github", files: ["copilot-instructions.md"] },
  { src: "policies", glob: "*" },
  { src: "schemas", glob: "*.schema.json" },
];

function copyDir(srcDir, destDir, pattern) {
  if (!existsSync(srcDir)) return 0;
  mkdirSync(destDir, { recursive: true });

  const regex = new RegExp(
    "^" + pattern.replace(/\./g, "\\.").replace(/\*/g, ".*") + "$"
  );

  let count = 0;
  for (const entry of readdirSync(srcDir, { withFileTypes: true })) {
    if (entry.isFile() && regex.test(entry.name)) {
      copyFileSync(join(srcDir, entry.name), join(destDir, entry.name));
      count++;
      console.log(`  ✓ ${join(destDir, entry.name)}`);
    } else if (entry.isDirectory()) {
      count += copyDir(
        join(srcDir, entry.name),
        join(destDir, entry.name),
        pattern
      );
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

// ─── Main ───────────────────────────────────────────────────────────────────

const targetArg = process.argv[2];

if (!targetArg || targetArg === "--help" || targetArg === "-h") {
  console.log(`
Inspectra Init — install audit agents into a project

Usage:
  npx inspectra init <target-project-path>

What it copies:
  .github/agents/       → Copilot Custom Agent definitions
  .github/prompts/      → Reusable audit prompts
  .github/              → copilot-instructions.md (global rules)
  policies/             → Scoring rules, severity matrix, profiles
  schemas/              → JSON Schema contracts for findings & reports
`);
  process.exit(0);
}

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

  if (asset.glob) {
    total += copyDir(srcDir, destDir, asset.glob);
  } else if (asset.files) {
    total += copyFiles(srcDir, destDir, asset.files);
  }
}

console.log(`\nDone — ${total} files copied.`);
console.log("Open the target project in VS Code and the agents will appear in the Copilot dropdown.");
