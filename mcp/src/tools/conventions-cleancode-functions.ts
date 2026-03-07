import { readFile } from "node:fs/promises";
import { relative, extname } from "node:path";
import type { Finding } from "../types.js";
import type { ProfileConfig } from "../policies/loader.js";
import { collectAllFiles } from "../utils/files.js";
import { createIdSequence } from "../utils/id.js";

const SUPPORTED_EXTENSIONS = new Set([".ts", ".js", ".java", ".py", ".go", ".kt"]);
const TEST_INFRA_PATH = /(?:^|[/\\])(?:__tests__|test__|tests|fixtures|__mocks__|e2e|spec)(?:[/\\]|$)/;

const DEFAULT_FUNCTION_LENGTH_WARNING = 30;
const DEFAULT_FUNCTION_LENGTH_ERROR = 60;

/**
 * Language-agnostic regex patterns that identify the start of a function/method.
 * Each captures the function name in group 1.
 */
const FUNCTION_START_PATTERNS = [
  // TS/JS: function name(, async function name(, export function name(
  /(?:export\s+)?(?:async\s+)?function\s+(\w+)\s*\(/,
  // TS/JS: method(, async method(
  /^\s+(?:(?:public|private|protected|static|async|readonly)\s+)*(\w+)\s*\([^)]*\)\s*(?::\s*\S+)?\s*\{/,
  // TS/JS: arrow const name = (...) => {
  /(?:const|let|var)\s+(\w+)\s*=\s*(?:async\s+)?(?:\([^)]*\)|[^=])\s*=>\s*\{/,
  // Java: access modifier + return type + name(
  /^\s+(?:(?:public|private|protected|static|final|abstract|synchronized)\s+)*\w[\w<>,\s]*\s+(\w+)\s*\([^)]*\)\s*(?:throws\s+\w[\w,\s]*)?\s*\{/,
  // Python: def name(
  /^\s*(?:async\s+)?def\s+(\w+)\s*\(/,
  // Go: func name( or func (receiver) name(
  /^func\s+(?:\(\w+\s+\*?\w+\)\s+)?(\w+)\s*\(/,
];

interface FunctionSpan {
  name: string;
  startLine: number;
  lineCount: number;
}

function extractFunctions(content: string): FunctionSpan[] {
  const lines = content.split("\n");
  const spans: FunctionSpan[] = [];

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (!line) continue;

    for (const pattern of FUNCTION_START_PATTERNS) {
      const match = pattern.exec(line);
      if (!match) continue;

      const name = match[1] ?? "anonymous";
      const bodyLength = measureFunctionBody(lines, i);
      if (bodyLength > 0) {
        spans.push({ name, startLine: i + 1, lineCount: bodyLength });
      }
      break;
    }
  }

  return spans;
}

/**
 * Counts lines from the opening brace to the matching closing brace.
 * For Python (no braces), counts indented lines after `def`.
 */
function measureFunctionBody(lines: string[], startIndex: number): number {
  const startLine = lines[startIndex] ?? "";

  if (/^\s*(?:async\s+)?def\s+/.test(startLine)) {
    return measurePythonBody(lines, startIndex);
  }

  let braceDepth = 0;
  let foundOpen = false;

  for (let i = startIndex; i < lines.length; i++) {
    const line = lines[i] ?? "";
    for (const char of line) {
      if (char === "{") {
        braceDepth++;
        foundOpen = true;
      } else if (char === "}") {
        braceDepth--;
        if (foundOpen && braceDepth === 0) {
          return i - startIndex + 1;
        }
      }
    }
  }

  return 0;
}

function measurePythonBody(lines: string[], defIndex: number): number {
  const defLine = lines[defIndex] ?? "";
  const defIndent = defLine.search(/\S/);
  let end = defIndex;

  for (let i = defIndex + 1; i < lines.length; i++) {
    const line = lines[i] ?? "";
    if (line.trim() === "") {
      end = i;
      continue;
    }
    const indent = line.search(/\S/);
    if (indent <= defIndent) break;
    end = i;
  }

  return end - defIndex + 1;
}

/**
 * Flags functions/methods exceeding configurable line-length thresholds.
 * Maps to Clean Code rules F1, G30, G34.
 */
export async function checkFunctionLengths(projectDir: string, profile?: ProfileConfig): Promise<Finding[]> {
  const findings: Finding[] = [];
  const nextId = createIdSequence("CNV", 300);

  const warningThreshold =
    (profile as Record<string, unknown> | undefined)?.["function_lengths_warning"] as number | undefined ??
    DEFAULT_FUNCTION_LENGTH_WARNING;
  const errorThreshold =
    (profile as Record<string, unknown> | undefined)?.["function_lengths_error"] as number | undefined ??
    DEFAULT_FUNCTION_LENGTH_ERROR;

  const files = await collectAllFiles(projectDir);

  for (const filePath of files) {
    if (!SUPPORTED_EXTENSIONS.has(extname(filePath))) continue;
    if (TEST_INFRA_PATH.test(relative(projectDir, filePath))) continue;

    try {
      const content = await readFile(filePath, "utf-8");
      const functions = extractFunctions(content);

      for (const fn of functions) {
        if (fn.lineCount <= warningThreshold) continue;

        const isError = fn.lineCount > errorThreshold;
        findings.push({
          id: nextId(),
          severity: isError ? "high" : "medium",
          title: `Function too long: ${fn.name} (${fn.lineCount} lines)`,
          description: `Function "${fn.name}" in ${relative(projectDir, filePath)} is ${fn.lineCount} lines. ` +
            `Functions over ${warningThreshold} lines violate the single-responsibility principle and are harder to test.`,
          domain: "conventions",
          rule: "function-too-long",
          confidence: 0.9,
          evidence: [{
            file: relative(projectDir, filePath),
            line: fn.startLine,
            snippet: `${fn.name}() — ${fn.lineCount} lines`,
          }],
          recommendation:
            "Extract sub-responsibilities into smaller, well-named helper functions. " +
            "Each function should do one thing at one level of abstraction (Clean Code G30, G34).",
          effort: "medium",
          tags: ["clean-code", "function-length", "maintainability"],
          source: "tool",
        });
      }
    } catch {
      /* skip unreadable files */
    }
  }

  return findings;
}
