import { readFile } from "node:fs/promises";
import { relative, extname } from "node:path";
import type { Finding } from "../types.js";
import { collectAllFiles } from "../utils/files.js";
import { createIdSequence } from "../utils/id.js";
import { SUPPORTED_EXTENSIONS, TEST_INFRA_PATH, MAX_SNIPPET_LENGTH } from "../utils/shared-constants.js";

/**
 * Common numeric literals that are NOT magic numbers.
 * These appear universally and are self-explanatory.
 */
const SAFE_NUMBERS = new Set([
  "0", "1", "-1", "2", "0.0", "1.0", "0.5", "100",
]);

/**
 * Patterns indicating a line is a constant declaration (magic number already fixed).
 */
const CONSTANT_DECLARATION = /(?:const|final|static|readonly|#|UPPER_CASE)\s/;

/**
 * Pattern matching a standalone numeric literal in a non-declaration context.
 * Captures the number (group 1).
 */
const MAGIC_NUMBER_PATTERN = /(?<![.\w])(-?\d+\.?\d*(?:e[+-]?\d+)?)(?![.\w])/gi;

/**
 * Lines to skip: imports, comments, type annotations, test assertions.
 */
function isSkippableLine(line: string): boolean {
  const trimmed = line.trim();
  return (
    trimmed.startsWith("//") ||
    trimmed.startsWith("*") ||
    trimmed.startsWith("/*") ||
    trimmed.startsWith("import ") ||
    trimmed.startsWith("from ") ||
    trimmed.startsWith("export type") ||
    trimmed.startsWith("export interface") ||
    trimmed.startsWith("#") ||
    /^\s*@\w/.test(trimmed) ||
    /\.(toEqual|toBe|toHaveLength|expect|assert)\s*\(/.test(trimmed)
  );
}

interface MagicNumberHit {
  value: string;
  line: number;
  snippet: string;
}

function findMagicNumbers(content: string): MagicNumberHit[] {
  const lines = content.split("\n");
  const hits: MagicNumberHit[] = [];

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i] ?? "";
    if (isSkippableLine(line)) continue;
    if (CONSTANT_DECLARATION.test(line)) continue;

    MAGIC_NUMBER_PATTERN.lastIndex = 0;
    let match: RegExpExecArray | null;

    while ((match = MAGIC_NUMBER_PATTERN.exec(line)) !== null) {
      const value = match[1] ?? match[0];
      if (SAFE_NUMBERS.has(value)) continue;

      const before = line.substring(0, match.index);
      if (before.endsWith("[") || /version|port|length|size|index|offset/i.test(before)) continue;

      hits.push({
        value,
        line: i + 1,
        snippet: line.trim().substring(0, MAX_SNIPPET_LENGTH),
      });
    }
  }

  return hits;
}

/**
 * Detects unnamed numeric constants (magic numbers) in source files.
 * Maps to Clean Code rule G25 (Replace Magic Numbers with Named Constants).
 */
export async function checkMagicNumbers(projectDir: string): Promise<Finding[]> {
  const findings: Finding[] = [];
  const nextId = createIdSequence("CNV", 400);
  const MAX_FINDINGS_PER_FILE = 5;

  const files = await collectAllFiles(projectDir);

  for (const filePath of files) {
    if (!SUPPORTED_EXTENSIONS.has(extname(filePath))) continue;
    if (TEST_INFRA_PATH.test(relative(projectDir, filePath))) continue;

    try {
      const content = await readFile(filePath, "utf-8");
      const hits = findMagicNumbers(content);

      const reported = hits.slice(0, MAX_FINDINGS_PER_FILE);
      for (const hit of reported) {
        findings.push({
          id: nextId(),
          severity: "low",
          title: `Magic number: ${hit.value} in ${relative(projectDir, filePath)}`,
          description: `The literal ${hit.value} appears without a named constant. ` +
            `Magic numbers obscure intent and make code harder to maintain.`,
          domain: "conventions",
          rule: "magic-number",
          confidence: 0.85,
          evidence: [{
            file: relative(projectDir, filePath),
            line: hit.line,
            snippet: hit.snippet,
          }],
          recommendation:
            `Extract ${hit.value} into a named constant (e.g., \`const MEANINGFUL_NAME = ${hit.value};\`). ` +
            "Named constants are searchable, self-documenting, and single-source-of-truth (Clean Code G25).",
          effort: "trivial",
          tags: ["clean-code", "magic-number", "readability"],
          source: "tool",
        });
      }
    } catch {
      /* skip unreadable files */
    }
  }

  return findings;
}
