import { readFile } from "node:fs/promises";
import { relative, extname } from "node:path";
import type { Finding } from "../types.js";
import { collectAllFiles } from "../utils/files.js";
import { createIdSequence } from "../utils/id.js";

const SUPPORTED_EXTENSIONS = new Set([".ts", ".js", ".java", ".py", ".go", ".kt"]);
const TEST_INFRA_PATH = /(?:^|[/\\])(?:__tests__|test__|tests|fixtures|__mocks__|e2e|spec)(?:[/\\]|$)/;
const MAX_SNIPPET_LENGTH = 120;

/* ------------------------------------------------------------------ */
/*  checkDeadExports                                                   */
/* ------------------------------------------------------------------ */

const EXPORT_PATTERNS = [
  // TS/JS: export function name, export class name, export const name, export type name, export interface name
  /export\s+(?:default\s+)?(?:function|class|const|let|var|type|interface|enum|abstract\s+class)\s+(\w+)/g,
  // TS/JS: export { name }
  /export\s*\{([^}]+)\}/g,
];

/**
 * Lightweight extraction of exported symbol names from a TS/JS source file.
 */
function extractExportedSymbols(content: string): string[] {
  const symbols: string[] = [];

  for (const pattern of EXPORT_PATTERNS) {
    pattern.lastIndex = 0;
    let match: RegExpExecArray | null;
    while ((match = pattern.exec(content)) !== null) {
      const capture = match[1] ?? "";
      if (capture.includes(",")) {
        for (const part of capture.split(",")) {
          const name = part.trim().split(/\s+as\s+/).pop()?.trim();
          if (name && /^\w+$/.test(name)) symbols.push(name);
        }
      } else {
        const name = capture.trim();
        if (name && /^\w+$/.test(name)) symbols.push(name);
      }
    }
  }

  return symbols;
}

/**
 * Detects exported symbols that are never imported anywhere else in the project.
 * Dead exports are code that exists but serves no purpose, increasing the surface area to maintain.
 */
export async function checkDeadExports(projectDir: string): Promise<Finding[]> {
  const findings: Finding[] = [];
  const nextId = createIdSequence("DEBT", 300);

  const files = await collectAllFiles(projectDir);
  const sourceFiles = files.filter((f) => {
    const ext = extname(f);
    return (ext === ".ts" || ext === ".js") && !TEST_INFRA_PATH.test(relative(projectDir, f));
  });

  if (sourceFiles.length === 0) return [];

  // Phase 1: Build a map of file → exported symbols
  const exportMap = new Map<string, { symbols: string[]; content: string }>();
  for (const filePath of sourceFiles) {
    try {
      const content = await readFile(filePath, "utf-8");
      const symbols = extractExportedSymbols(content);
      if (symbols.length > 0) {
        exportMap.set(filePath, { symbols, content });
      }
    } catch { /* skip */ }
  }

  // Phase 2: Gather all file contents for import checking
  const allContents = new Map<string, string>();
  for (const filePath of sourceFiles) {
    if (exportMap.has(filePath)) {
      allContents.set(filePath, exportMap.get(filePath)!.content);
    } else {
      try {
        allContents.set(filePath, await readFile(filePath, "utf-8"));
      } catch { /* skip */ }
    }
  }

  // Phase 3: For each exported symbol, check if any OTHER file imports it
  const MAX_FINDINGS = 20;
  for (const [filePath, { symbols }] of exportMap) {
    if (findings.length >= MAX_FINDINGS) break;

    for (const symbol of symbols) {
      if (findings.length >= MAX_FINDINGS) break;

      // Skip common entry-point patterns
      if (symbol === "default" || symbol === "main" || symbol === "handler") continue;

      let isImported = false;
      for (const [otherFile, otherContent] of allContents) {
        if (otherFile === filePath) continue;

        // Check for: import { symbol }, import symbol, re-export, or direct reference
        if (otherContent.includes(symbol)) {
          isImported = true;
          break;
        }
      }

      if (!isImported) {
        const rel = relative(projectDir, filePath);
        findings.push({
          id: nextId(),
          severity: "low",
          title: `Dead export: "${symbol}" in ${rel}`,
          description:
            `The exported symbol "${symbol}" from ${rel} is not imported by any other file in the project. ` +
            "Dead exports widen the public API surface without providing value.",
          domain: "tech-debt",
          rule: "dead-export",
          confidence: 0.8,
          evidence: [{ file: rel, snippet: `export … ${symbol}` }],
          recommendation:
            "Remove the export keyword if the symbol is only used locally, or delete it entirely if unused. " +
            "Reducing dead exports shrinks the maintainable surface area.",
          effort: "trivial",
          tags: ["dead-code", "exports", "maintainability"],
          source: "tool",
        });
      }
    }
  }

  return findings;
}

/* ------------------------------------------------------------------ */
/*  detectDeprecatedApis                                               */
/* ------------------------------------------------------------------ */

interface DeprecatedPattern {
  pattern: RegExp;
  framework: string;
  symbol: string;
  replacement: string;
  severity: "high" | "medium";
}

const DEPRECATED_PATTERNS: DeprecatedPattern[] = [
  // Angular
  { pattern: /\bComponentFactoryResolver\b/, framework: "Angular", symbol: "ComponentFactoryResolver", replacement: "ViewContainerRef.createComponent()", severity: "high" },
  { pattern: /\bModuleWithComponentFactories\b/, framework: "Angular", symbol: "ModuleWithComponentFactories", replacement: "standalone components or ViewContainerRef", severity: "high" },
  { pattern: /\bgetModuleFactory\b/, framework: "Angular", symbol: "getModuleFactory()", replacement: "standalone components", severity: "high" },
  { pattern: /\bnew Renderer(?!2)\b/, framework: "Angular", symbol: "Renderer (v1)", replacement: "Renderer2", severity: "medium" },
  { pattern: /\bReflectiveInjector\b/, framework: "Angular", symbol: "ReflectiveInjector", replacement: "Injector.create()", severity: "medium" },

  // React
  { pattern: /\bcomponentWillMount\b/, framework: "React", symbol: "componentWillMount", replacement: "componentDidMount or useEffect", severity: "high" },
  { pattern: /\bcomponentWillUpdate\b/, framework: "React", symbol: "componentWillUpdate", replacement: "componentDidUpdate or useEffect", severity: "high" },
  { pattern: /\bcomponentWillReceiveProps\b/, framework: "React", symbol: "componentWillReceiveProps", replacement: "getDerivedStateFromProps or useEffect", severity: "high" },
  { pattern: /\bfindDOMNode\b/, framework: "React", symbol: "findDOMNode", replacement: "useRef()", severity: "medium" },
  { pattern: /\bReactDOM\.render\b/, framework: "React", symbol: "ReactDOM.render()", replacement: "createRoot().render() (React 18+)", severity: "high" },

  // TypeORM
  { pattern: /\bgetConnection\(\)/, framework: "TypeORM", symbol: "getConnection()", replacement: "DataSource instance", severity: "medium" },
  { pattern: /\bcreateConnection\(\)/, framework: "TypeORM", symbol: "createConnection()", replacement: "new DataSource().initialize()", severity: "medium" },

  // Spring Boot / Java
  { pattern: /@EnableSwagger2\b/, framework: "Spring Boot", symbol: "@EnableSwagger2", replacement: "SpringDoc OpenAPI", severity: "medium" },
  { pattern: /\bWebSecurityConfigurerAdapter\b/, framework: "Spring Boot", symbol: "WebSecurityConfigurerAdapter", replacement: "SecurityFilterChain bean (Spring Security 5.7+)", severity: "high" },
  { pattern: /\bextends CrudRepository\b/, framework: "Spring Data", symbol: "CrudRepository", replacement: "ListCrudRepository (Spring Data 3.0+)", severity: "low" as "medium" },

  // Node.js
  { pattern: /\brequire\(\s*['"]domain['"]\s*\)/, framework: "Node.js", symbol: "domain module", replacement: "AsyncLocalStorage", severity: "medium" },
  { pattern: /\bnew Buffer\(/, framework: "Node.js", symbol: "new Buffer()", replacement: "Buffer.from() / Buffer.alloc()", severity: "high" },
];

/**
 * Detects usage of known deprecated framework APIs.
 * Pattern-based detection for Angular, React, TypeORM, Spring Boot, and Node.js.
 */
export async function detectDeprecatedApis(projectDir: string): Promise<Finding[]> {
  const findings: Finding[] = [];
  const nextId = createIdSequence("DEBT", 350);

  const files = await collectAllFiles(projectDir);

  for (const filePath of files) {
    if (!SUPPORTED_EXTENSIONS.has(extname(filePath))) continue;
    if (TEST_INFRA_PATH.test(relative(projectDir, filePath))) continue;

    try {
      const content = await readFile(filePath, "utf-8");
      const lines = content.split("\n");

      for (const dep of DEPRECATED_PATTERNS) {
        dep.pattern.lastIndex = 0;
        for (let i = 0; i < lines.length; i++) {
          const line = lines[i] ?? "";
          // Skip import lines — the import itself is not the problem, the usage is
          if (/^\s*import\s/.test(line)) continue;
          // Skip comments
          if (/^\s*(?:\/\/|\/\*|\*)/.test(line)) continue;

          if (dep.pattern.test(line)) {
            const rel = relative(projectDir, filePath);
            findings.push({
              id: nextId(),
              severity: dep.severity,
              title: `Deprecated ${dep.framework} API: ${dep.symbol}`,
              description:
                `${dep.symbol} is deprecated in ${dep.framework}. ` +
                `Replace with: ${dep.replacement}.`,
              domain: "tech-debt",
              rule: "deprecated-api-usage",
              confidence: 0.9,
              evidence: [{
                file: rel,
                line: i + 1,
                snippet: line.trim().substring(0, MAX_SNIPPET_LENGTH),
              }],
              recommendation: `Migrate from ${dep.symbol} to ${dep.replacement}.`,
              effort: "medium",
              tags: ["deprecated", dep.framework.toLowerCase().replace(/\s+/g, "-"), "migration"],
              source: "tool",
            });
            break; // One finding per pattern per file
          }
        }
      }
    } catch { /* skip */ }
  }

  return findings;
}

/* ------------------------------------------------------------------ */
/*  detectCodeSmells                                                   */
/* ------------------------------------------------------------------ */

const GOD_CLASS_METHOD_THRESHOLD = 10;
const GOD_CLASS_LINE_THRESHOLD = 500;
const DEEP_NESTING_THRESHOLD = 4;

interface ClassSpan {
  name: string;
  startLine: number;
  lineCount: number;
  methodCount: number;
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

    // Count methods inside the class body
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
 * Finds the maximum nesting depth of braces/indentation in a file.
 * Returns line number and depth of the deepest nesting.
 */
function findDeepNesting(content: string): { line: number; depth: number; snippet: string } | null {
  const lines = content.split("\n");
  let maxDepth = 0;
  let maxLine = 0;
  let maxSnippet = "";
  let currentDepth = 0;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i] ?? "";
    // Skip comments and blank lines
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
 * Detects structural code smells: God classes and deeply nested code.
 *
 * - God class: A class with too many methods (>10) or too many lines (>500),
 *   indicating it does too much and violates Single Responsibility.
 * - Deep nesting: Code nested >4 levels deep, indicating complex branching
 *   that should be flattened with early returns or extraction.
 */
export async function detectCodeSmells(projectDir: string): Promise<Finding[]> {
  const findings: Finding[] = [];
  const nextId = createIdSequence("DEBT", 400);

  const files = await collectAllFiles(projectDir);

  for (const filePath of files) {
    if (!SUPPORTED_EXTENSIONS.has(extname(filePath))) continue;
    if (TEST_INFRA_PATH.test(relative(projectDir, filePath))) continue;

    try {
      const content = await readFile(filePath, "utf-8");
      const rel = relative(projectDir, filePath);

      // God class detection
      const classes = extractClasses(content);
      for (const cls of classes) {
        const isGodByMethods = cls.methodCount > GOD_CLASS_METHOD_THRESHOLD;
        const isGodByLines = cls.lineCount > GOD_CLASS_LINE_THRESHOLD;

        if (isGodByMethods || isGodByLines) {
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
      }

      // Deep nesting detection
      const nesting = findDeepNesting(content);
      if (nesting) {
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
      }
    } catch { /* skip */ }
  }

  return findings;
}
