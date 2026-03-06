import { readFile } from "node:fs/promises";
import { relative, extname } from "node:path";
import type { Finding } from "../types.js";
import type { ProfileConfig } from "../policies/loader.js";
import { collectAllFiles } from "../utils/files.js";
import { createIdSequence } from "../utils/id.js";

const SUPPORTED_EXTENSIONS = new Set([".ts", ".js", ".java", ".py", ".go", ".kt"]);
const TEST_INFRA_PATH = /(?:^|[/\\])(?:__tests__|test__|tests|fixtures|__mocks__|e2e|spec)(?:[/\\]|$)/;
const MAX_SNIPPET_LENGTH = 120;

/* ------------------------------------------------------------------ */
/*  checkFunctionLengths                                               */
/* ------------------------------------------------------------------ */

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

  // Python: indent-based
  if (/^\s*(?:async\s+)?def\s+/.test(startLine)) {
    return measurePythonBody(lines, startIndex);
  }

  // Brace-based languages
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

/* ------------------------------------------------------------------ */
/*  checkParamCounts                                                   */
/* ------------------------------------------------------------------ */

const DEFAULT_PARAM_COUNT_WARNING = 3;
const DEFAULT_PARAM_COUNT_ERROR = 5;

/**
 * Regex patterns for extracting function parameters.
 * Each must capture the full parameter list in group 1.
 */
const PARAM_PATTERNS = [
  // TS/JS/Java: function/method declarations with parenthesized params
  /(?:(?:export|public|private|protected|static|final|abstract|async|readonly)\s+)*(?:function\s+)?(\w+)\s*\(([^)]*)\)\s*(?::\s*[^{]+)?\s*\{/,
  // Arrow: const name = (params) => {
  /(?:const|let|var)\s+(\w+)\s*=\s*(?:async\s+)?\(([^)]*)\)\s*(?::\s*\S+)?\s*=>\s*\{/,
  // Python: def name(params):
  /(?:async\s+)?def\s+(\w+)\s*\(([^)]*)\)\s*(?:->\s*\S+)?\s*:/,
  // Go: func name(params) or func (r Type) name(params)
  /func\s+(?:\(\w+\s+\*?\w+\)\s+)?(\w+)\s*\(([^)]*)\)/,
];

interface ParamInfo {
  name: string;
  paramCount: number;
  line: number;
  params: string;
}

function extractFunctionParams(content: string): ParamInfo[] {
  const lines = content.split("\n");
  const results: ParamInfo[] = [];

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (!line) continue;

    for (const pattern of PARAM_PATTERNS) {
      const match = pattern.exec(line);
      if (!match) continue;

      const name = match[1] ?? "anonymous";
      const rawParams = match[2] ?? "";
      const paramCount = countParams(rawParams);

      if (paramCount > 0) {
        results.push({ name, paramCount, line: i + 1, params: rawParams.trim() });
      }
      break;
    }
  }

  return results;
}

function countParams(rawParams: string): number {
  const cleaned = rawParams.trim();
  if (cleaned === "" || cleaned === "self" || cleaned === "this") return 0;

  const params = splitParams(cleaned);
  // Exclude 'self' (Python) and 'this' (explicit) from count
  return params.filter((p) => {
    const name = p.trim().split(/[\s:=]/)[0] ?? "";
    return name !== "self" && name !== "this" && name !== "";
  }).length;
}

function splitParams(raw: string): string[] {
  const params: string[] = [];
  let depth = 0;
  let current = "";

  for (const char of raw) {
    if (char === "<" || char === "(" || char === "[") depth++;
    else if (char === ">" || char === ")" || char === "]") depth--;
    else if (char === "," && depth === 0) {
      params.push(current);
      current = "";
      continue;
    }
    current += char;
  }
  if (current.trim()) params.push(current);

  return params;
}

/**
 * Flags functions with too many parameters.
 * Maps to Clean Code rule F1 (Too Many Arguments).
 */
export async function checkParamCounts(projectDir: string, profile?: ProfileConfig): Promise<Finding[]> {
  const findings: Finding[] = [];
  const nextId = createIdSequence("CNV", 350);

  const warningThreshold =
    (profile as Record<string, unknown> | undefined)?.["param_count_warning"] as number | undefined ??
    DEFAULT_PARAM_COUNT_WARNING;
  const errorThreshold =
    (profile as Record<string, unknown> | undefined)?.["param_count_error"] as number | undefined ??
    DEFAULT_PARAM_COUNT_ERROR;

  const files = await collectAllFiles(projectDir);

  for (const filePath of files) {
    if (!SUPPORTED_EXTENSIONS.has(extname(filePath))) continue;
    if (TEST_INFRA_PATH.test(relative(projectDir, filePath))) continue;

    try {
      const content = await readFile(filePath, "utf-8");
      const functions = extractFunctionParams(content);

      for (const fn of functions) {
        if (fn.paramCount <= warningThreshold) continue;

        const isError = fn.paramCount > errorThreshold;
        findings.push({
          id: nextId(),
          severity: isError ? "high" : "medium",
          title: `Too many parameters: ${fn.name}(${fn.paramCount} params)`,
          description: `Function "${fn.name}" has ${fn.paramCount} parameters. ` +
            `Ideally functions should have 0–2 arguments. More than ${warningThreshold} makes testing combinatorially expensive.`,
          domain: "conventions",
          rule: "too-many-params",
          confidence: 0.9,
          evidence: [{
            file: relative(projectDir, filePath),
            line: fn.line,
            snippet: `${fn.name}(${fn.params.substring(0, MAX_SNIPPET_LENGTH)})`,
          }],
          recommendation:
            "Group related parameters into an options object or extract a dedicated data class. " +
            "Consider whether the function is doing too much (Clean Code F1).",
          effort: "medium",
          tags: ["clean-code", "parameter-count", "testability"],
          source: "tool",
        });
      }
    } catch {
      /* skip unreadable files */
    }
  }

  return findings;
}

/* ------------------------------------------------------------------ */
/*  checkMagicNumbers                                                  */
/* ------------------------------------------------------------------ */

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

    // Reset regex state
    MAGIC_NUMBER_PATTERN.lastIndex = 0;
    let match: RegExpExecArray | null;

    while ((match = MAGIC_NUMBER_PATTERN.exec(line)) !== null) {
      const value = match[1] ?? match[0];
      if (SAFE_NUMBERS.has(value)) continue;

      // Skip array indices like [2], enum values, and port/version-like contexts
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
