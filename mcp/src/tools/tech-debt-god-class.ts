import { readFile } from "node:fs/promises";
import { relative, extname } from "node:path";
import type { Finding } from "../types.js";
import { collectAllFiles } from "../utils/files.js";
import { createIdSequence } from "../utils/id.js";
import { SUPPORTED_EXTENSIONS, TEST_INFRA_PATH } from "../utils/shared-constants.js";

const GOD_CLASS_METHOD_THRESHOLD = 10;
const GOD_CLASS_LINE_THRESHOLD = 500;

interface ClassSpan {
  name: string;
  startLine: number;
  lineCount: number;
  methodCount: number;
}

function findMatchingBrace(lines: string[], startIndex: number): number {
  let depth = 0;
  let foundOpen = false;

  for (let i = startIndex; i < lines.length; i++) {
    const line = lines[i] ?? "";
    for (const char of line) {
      if (char === "{") { depth++; foundOpen = true; }
      else if (char === "}") {
        depth--;
        if (foundOpen && depth === 0) return i;
      }
    }
  }
  return startIndex;
}

/**
 * Extracts classes from TS/JS/Java source and counts their methods and lines.
 */
function extractClasses(content: string): ClassSpan[] {
  const lines = content.split("\n");
  const classes: ClassSpan[] = [];
  const classStartPattern = /(?:export\s+)?(?:abstract\s+)?(?:public\s+)?class\s+(\w+)/;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i] ?? "";
    const match = classStartPattern.exec(line);
    if (!match) continue;

    const name = match[1] ?? "Unknown";
    const bodyEnd = findMatchingBrace(lines, i);
    if (bodyEnd <= i) continue;

    let methodCount = 0;
    const methodPattern = /^\s+(?:(?:public|private|protected|static|async|abstract|readonly|override)\s+)*(\w+)\s*\([^)]*\)\s*(?::\s*\S+)?\s*\{/;
    const javaMethodPattern = /^\s+(?:(?:public|private|protected|static|final|abstract|synchronized)\s+)*\w[\w<>,\s]*\s+(\w+)\s*\([^)]*\)\s*(?:throws\s+\w[\w,\s]*)?\s*\{/;

    for (let j = i + 1; j < bodyEnd; j++) {
      const bodyLine = lines[j] ?? "";
      if (methodPattern.test(bodyLine) || javaMethodPattern.test(bodyLine)) {
        methodCount++;
      }
    }

    classes.push({
      name,
      startLine: i + 1,
      lineCount: bodyEnd - i + 1,
      methodCount,
    });
  }

  return classes;
}

/**
 * Detects God classes: classes with too many methods (>10) or too many lines (>500).
 * God classes violate the Single Responsibility Principle and resist change.
 */
export async function detectGodClasses(projectDir: string): Promise<Finding[]> {
  const findings: Finding[] = [];
  const nextId = createIdSequence("DEBT", 400);

  const files = await collectAllFiles(projectDir);

  for (const filePath of files) {
    if (!SUPPORTED_EXTENSIONS.has(extname(filePath))) continue;
    if (TEST_INFRA_PATH.test(relative(projectDir, filePath))) continue;

    try {
      const content = await readFile(filePath, "utf-8");
      const rel = relative(projectDir, filePath);
      const classes = extractClasses(content);

      for (const cls of classes) {
        const isGodByMethods = cls.methodCount > GOD_CLASS_METHOD_THRESHOLD;
        const isGodByLines = cls.lineCount > GOD_CLASS_LINE_THRESHOLD;

        if (!isGodByMethods && !isGodByLines) continue;

        const reason = isGodByMethods && isGodByLines
          ? `${cls.methodCount} methods and ${cls.lineCount} lines`
          : isGodByMethods
            ? `${cls.methodCount} methods`
            : `${cls.lineCount} lines`;

        findings.push({
          id: nextId(),
          severity: (isGodByMethods && isGodByLines) ? "high" : "medium",
          title: `God class: ${cls.name} (${reason})`,
          description:
            `Class "${cls.name}" in ${rel} has ${reason}. ` +
            "God classes violate the Single Responsibility Principle and resist change.",
          domain: "tech-debt",
          rule: "god-class",
          confidence: 0.85,
          evidence: [{
            file: rel,
            line: cls.startLine,
            snippet: `class ${cls.name} — ${reason}`,
          }],
          recommendation:
            `Split ${cls.name} into smaller, focused classes. ` +
            "Group related methods into separate services or helpers.",
          effort: "large",
          tags: ["code-smell", "god-class", "srp"],
          source: "tool",
        });
      }
    } catch { /* skip */ }
  }

  return findings;
}
