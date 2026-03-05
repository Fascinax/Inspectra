import { readFile } from "node:fs/promises";
import { relative, extname } from "node:path";
import type { Finding } from "../types.js";
import { collectAllFiles } from "../utils/files.js";
import { createIdSequence } from "../utils/id.js";

const BLOCK_SIZE = 6;
const MIN_BLOCK_LENGTH = 80;
const TEST_INFRA_PATH = /[/\\](?:__tests__|fixtures)[/\\]/;
const SUPPORTED_EXTENSIONS = new Set([".ts", ".js", ".java"]);

/**
 * Detects copy-paste / DRY violations by finding near-identical code blocks
 * (>= 6 consecutive lines) that appear in multiple files.
 */
export async function detectDryViolations(projectDir: string): Promise<Finding[]> {
  const files = await collectAllFiles(projectDir);
  const srcFiles = files.filter(
    (f) => SUPPORTED_EXTENSIONS.has(extname(f)) && !TEST_INFRA_PATH.test(relative(projectDir, f)),
  );

  const blockMap = await buildBlockMap(srcFiles, projectDir);
  return createDryFindings(blockMap);
}

async function buildBlockMap(
  srcFiles: string[],
  projectDir: string,
): Promise<Map<string, Array<{ file: string; startLine: number }>>> {
  const blockMap = new Map<string, Array<{ file: string; startLine: number }>>();

  for (const filePath of srcFiles) {
    try {
      const content = await readFile(filePath, "utf-8");
      const normalized = normalizeLines(content);
      indexBlocks(normalized, relative(projectDir, filePath), blockMap);
    } catch {
      /* skip unreadable files */
    }
  }

  return blockMap;
}

function normalizeLines(content: string): string[] {
  return content
    .split("\n")
    .map((l) => l.trim())
    .filter(isSignificantLine);
}

function isSignificantLine(line: string): boolean {
  return (
    line.length > 2 &&
    !line.startsWith("//") &&
    !line.startsWith("*") &&
    !line.startsWith("import ") &&
    line !== "{" &&
    line !== "}" &&
    line !== "})" &&
    line !== "});" &&
    line !== "});"
  );
}

function indexBlocks(
  normalized: string[],
  relPath: string,
  blockMap: Map<string, Array<{ file: string; startLine: number }>>,
): void {
  for (let i = 0; i <= normalized.length - BLOCK_SIZE; i++) {
    const block = normalized.slice(i, i + BLOCK_SIZE).join("\n");
    if (block.length < MIN_BLOCK_LENGTH) continue;
    const existing = blockMap.get(block) ?? [];
    existing.push({ file: relPath, startLine: i + 1 });
    blockMap.set(block, existing);
  }
}

function createDryFindings(
  blockMap: Map<string, Array<{ file: string; startLine: number }>>,
): Finding[] {
  const findings: Finding[] = [];
  const nextId = createIdSequence("CNV", 200);
  const alreadyFlagged = new Set<string>();

  for (const [, locations] of blockMap) {
    if (locations.length < 2) continue;

    const uniqueFiles = [...new Set(locations.map((l) => l.file))];
    if (uniqueFiles.length < 2) continue;

    const key = uniqueFiles.sort().join("|");
    if (alreadyFlagged.has(key)) continue;
    alreadyFlagged.add(key);

    findings.push({
      id: nextId(),
      severity: "low",
      title: `Duplicated code block across ${uniqueFiles.length} files`,
      description: `A block of ${BLOCK_SIZE}+ lines appears in multiple files: ${uniqueFiles.slice(0, 3).join(", ")}. This violates the DRY (Don't Repeat Yourself) principle.`,
      domain: "conventions",
      rule: "dry-violation",
      confidence: 0.7,
      evidence: locations.slice(0, 3).map((l) => ({ file: l.file, line: l.startLine })),
      recommendation: "Extract the duplicated logic into a shared utility function or module.",
      effort: "medium",
      tags: ["dry", "duplication", "maintainability"],
      source: "tool",
    });
  }

  return findings;
}
