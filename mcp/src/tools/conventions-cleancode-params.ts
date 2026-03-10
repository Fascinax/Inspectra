import { readFile } from "node:fs/promises";
import { relative, extname } from "node:path";
import type { Finding } from "../types.js";
import type { ProfileConfig } from "../policies/loader.js";
import { collectAllFiles } from "../utils/files.js";
import { createIdSequence } from "../utils/id.js";
import { SUPPORTED_EXTENSIONS, TEST_INFRA_PATH, MAX_SNIPPET_LENGTH } from "../utils/shared-constants.js";

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
