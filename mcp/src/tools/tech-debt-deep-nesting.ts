import { readFile } from "node:fs/promises";
import { relative, extname } from "node:path";
import type { Finding } from "../types.js";
import { collectAllFiles } from "../utils/files.js";
import { createIdSequence } from "../utils/id.js";

const SUPPORTED_EXTENSIONS = new Set([".ts", ".js", ".java", ".py", ".go", ".kt"]);
const TEST_INFRA_PATH = /(?:^|[/\\])(?:__tests__|test__|tests|fixtures|__mocks__|e2e|spec)(?:[/\\]|$)/;
const MAX_SNIPPET_LENGTH = 120;

const DEEP_NESTING_THRESHOLD = 4;

interface NestingResult {
  line: number;
  depth: number;
  snippet: string;
}

/**
 * Finds the maximum nesting depth of braces/indentation in a file.
 * Returns the location and depth of the deepest nesting found, or null
 * if it does not exceed the threshold.
 */
function findDeepNesting(content: string): NestingResult | null {
  const lines = content.split("\n");
  let maxDepth = 0;
  let maxLine = 0;
  let maxSnippet = "";
  let currentDepth = 0;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i] ?? "";
    if (/^\s*(?:\/\/|\/\*|\*|#)/.test(line) || line.trim() === "") continue;

    for (const char of line) {
      if (char === "{") currentDepth++;
      else if (char === "}") currentDepth--;
    }

    if (currentDepth > maxDepth) {
      maxDepth = currentDepth;
      maxLine = i + 1;
      maxSnippet = line.trim().substring(0, MAX_SNIPPET_LENGTH);
    }
  }

  return maxDepth > DEEP_NESTING_THRESHOLD
    ? { line: maxLine, depth: maxDepth, snippet: maxSnippet }
    : null;
}

/**
 * Detects deeply nested code blocks (>4 levels deep).
 * Deep nesting makes code hard to follow and test. Callers should prefer
 * guard clauses, early returns, or extracted helper functions.
 */
export async function detectDeepNesting(projectDir: string): Promise<Finding[]> {
  const findings: Finding[] = [];
  const nextId = createIdSequence("DEBT", 450);

  const files = await collectAllFiles(projectDir);

  for (const filePath of files) {
    if (!SUPPORTED_EXTENSIONS.has(extname(filePath))) continue;
    if (TEST_INFRA_PATH.test(relative(projectDir, filePath))) continue;

    try {
      const content = await readFile(filePath, "utf-8");
      const rel = relative(projectDir, filePath);
      const nesting = findDeepNesting(content);

      if (!nesting) continue;

      findings.push({
        id: nextId(),
        severity: nesting.depth > 6 ? "high" : "medium",
        title: `Deep nesting (${nesting.depth} levels) in ${rel}`,
        description:
          `${rel} has code nested ${nesting.depth} levels deep. ` +
          "Deep nesting makes code hard to follow and test.",
        domain: "tech-debt",
        rule: "deep-nesting",
        confidence: 0.85,
        evidence: [{
          file: rel,
          line: nesting.line,
          snippet: nesting.snippet,
        }],
        recommendation:
          "Flatten nesting with early returns (guard clauses), extract inner blocks into named functions, " +
          "or use strategy/command patterns to eliminate deep conditionals.",
        effort: "medium",
        tags: ["code-smell", "nesting", "readability"],
        source: "tool",
      });
    } catch { /* skip */ }
  }

  return findings;
}
