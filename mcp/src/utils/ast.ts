import { parse, type TSESTree } from "@typescript-eslint/typescript-estree";

const TS_LIKE_EXTENSIONS = new Set([".ts", ".tsx", ".mts", ".cts", ".js", ".jsx", ".mjs", ".cjs"]);

/** AST node types that each represent a decision point in cyclomatic complexity. */
const DECISION_NODE_TYPES = new Set([
  "IfStatement",
  "ConditionalExpression",
  "LogicalExpression",
  "ForStatement",
  "ForInStatement",
  "ForOfStatement",
  "WhileStatement",
  "DoWhileStatement",
  "CatchClause",
  "SwitchCase",
]);

function isAstNode(value: unknown): value is TSESTree.Node {
  return typeof value === "object" && value !== null && "type" in value;
}

function walkAst(node: TSESTree.Node, onNode: (n: TSESTree.Node) => void): void {
  onNode(node);
  for (const value of Object.values(node)) {
    if (Array.isArray(value)) {
      for (const child of value) {
        if (isAstNode(child)) walkAst(child, onNode);
      }
    } else if (isAstNode(value)) {
      walkAst(value, onNode);
    }
  }
}

function parseSource(source: string): TSESTree.Program {
  return parse(source, { jsx: true, range: false, loc: false, comment: false });
}

/**
 * Extracts static module specifiers (import / export-from) from TypeScript or JavaScript source.
 * Falls back to regex for non-parseable files (Java, etc.).
 *
 * @param source  File contents as a string.
 * @param fileExt Extension including the dot (e.g. `.ts`). Used to select the parser.
 */
export function extractModuleSpecifiers(source: string, fileExt = ".ts"): string[] {
  if (!TS_LIKE_EXTENSIONS.has(fileExt)) return extractSpecifiersFallback(source);

  try {
    const ast = parseSource(source);
    const specifiers: string[] = [];

    for (const stmt of ast.body) {
      if (stmt.type === "ImportDeclaration") {
        specifiers.push(stmt.source.value);
      } else if (stmt.type === "ExportNamedDeclaration" && stmt.source) {
        specifiers.push(stmt.source.value);
      } else if (stmt.type === "ExportAllDeclaration") {
        specifiers.push(stmt.source.value);
      }
    }

    return specifiers;
  } catch {
    return extractSpecifiersFallback(source);
  }
}

/**
 * Computes cyclomatic complexity from TypeScript or JavaScript source using the AST.
 * Falls back to a regex heuristic for non-parseable files (e.g. Java).
 *
 * @param source  File contents as a string.
 * @param fileExt Extension including the dot. Used to select the parser.
 */
export function computeCyclomaticComplexity(source: string, fileExt = ".ts"): number {
  if (!TS_LIKE_EXTENSIONS.has(fileExt)) return computeComplexityHeuristic(source);

  try {
    const ast = parseSource(source);
    let complexity = 1;

    walkAst(ast as unknown as TSESTree.Node, (node) => {
      if (!DECISION_NODE_TYPES.has(node.type)) return;
      // Default SwitchCase (`default:`) does not add a decision point
      if (node.type === "SwitchCase" && (node as TSESTree.SwitchCase).test === null) return;
      complexity++;
    });

    return complexity;
  } catch {
    return computeComplexityHeuristic(source);
  }
}

function extractSpecifiersFallback(source: string): string[] {
  const regex = /(?:import|from)\s+['"]([^'"]+)['"]/g;
  const results: string[] = [];
  let match: RegExpExecArray | null;
  while ((match = regex.exec(source)) !== null) {
    results.push(match[1] ?? "");
  }
  return results;
}

function computeComplexityHeuristic(source: string): number {
  const patterns = [/\bif\b/g, /\bfor\b/g, /\bwhile\b/g, /\bswitch\b/g, /\bcatch\b/g, /&&/g, /\|\|/g, /\?/g];
  let score = 1;
  for (const p of patterns) score += [...source.matchAll(p)].length;
  return score;
}
