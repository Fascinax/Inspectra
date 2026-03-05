import { readFile } from "node:fs/promises";
import { extname, relative } from "node:path";
import type { Finding } from "../types.js";
import { collectAllFiles } from "../utils/files.js";
import { createIdSequence } from "../utils/id.js";
import { computeCyclomaticComplexity } from "../utils/ast.js";

/**
 * Estimate complexity using lightweight cyclomatic heuristics per file.
 */
export async function analyzeComplexity(projectDir: string, threshold = 35): Promise<Finding[]> {
  const findings: Finding[] = [];
  const nextId = createIdSequence("DEBT");
  const files = await collectAllFiles(projectDir);

  for (const filePath of files) {
    if (![".ts", ".js", ".java"].includes(extname(filePath))) continue;

    try {
      const content = await readFile(filePath, "utf-8");
      const complexity = computeCyclomaticComplexity(content, extname(filePath));
      if (complexity < threshold) continue;

      findings.push({
        id: nextId(),
        severity: complexity > 60 ? "high" : "medium",
        title: `High estimated complexity: ${relative(projectDir, filePath)} (score ${complexity})`,
        description: "Complex files are harder to maintain, test, and safely modify.",
        domain: "tech-debt",
        rule: "high-complexity",
        confidence: 0.8,
        evidence: [{ file: relative(projectDir, filePath), snippet: `estimated_complexity=${complexity}` }],
        recommendation: "Refactor into smaller functions/modules and simplify branching logic.",
        effort: "large",
        tags: ["complexity", "maintainability"],
        source: "tool",
      });
    } catch {
      /* skip unreadable files */
    }
  }

  return findings;
}

/**
 * Detect aged TODO/FIXME comments when an inline date is present.
 * Supported date formats: YYYY-MM-DD, YYYY/MM/DD.
 */
export async function ageTodos(projectDir: string): Promise<Finding[]> {
  const findings: Finding[] = [];
  const nextId = createIdSequence("DEBT", 100);
  const files = await collectAllFiles(projectDir);
  const now = Date.now();

  for (const filePath of files) {
    if (![".ts", ".js", ".java", ".md"].includes(extname(filePath))) continue;

    try {
      const content = await readFile(filePath, "utf-8");
      const lines = content.split("\n");

      for (let i = 0; i < lines.length; i++) {
        const line = lines[i];
        if (!line) continue;

        // Only flag dated TODO/FIXME that appear in actual comment lines, not in string literals
        if (!/^\s*(?:\/\/|\/\*|\*|#).*\b(TODO|FIXME|HACK)\b/i.test(line)) continue;
        const dateMatch = line.match(/\b(\d{4}[-/]\d{2}[-/]\d{2})\b/);
        if (!dateMatch) continue;

        const rawDate = dateMatch[1];
        if (!rawDate) continue;
        const parsedDate = new Date(rawDate.replaceAll("/", "-")).getTime();
        if (Number.isNaN(parsedDate)) continue;

        const ageDays = Math.floor((now - parsedDate) / (1000 * 60 * 60 * 24));
        if (ageDays < 90) continue;

        findings.push({
          id: nextId(),
          severity: ageDays > 365 ? "high" : "medium",
          title: `Aged TODO/FIXME (${ageDays} days): ${relative(projectDir, filePath)}`,
          description: "Old unresolved comments indicate accumulating technical debt.",
          domain: "tech-debt",
          rule: "aged-todo",
          confidence: 0.95,
          evidence: [{ file: relative(projectDir, filePath), line: i + 1, snippet: line.trim().slice(0, 140) }],
          recommendation: "Resolve this item or convert it into a tracked issue with an owner and due date.",
          effort: "small",
          tags: ["todo", "debt"],
          source: "tool",
        });
      }
    } catch {
      /* skip unreadable files */
    }
  }

  return findings;
}

/**
 * Heuristic for dependency staleness risk from manifest indicators.
 */
export async function checkDependencyStaleness(projectDir: string): Promise<Finding[]> {
  const nextId = createIdSequence("DEBT", 200);
  let packageJsonRaw: string;

  try {
    packageJsonRaw = await readFile(`${projectDir}/package.json`, "utf-8");
  } catch {
    return [];
  }

  try {
    const parsed = JSON.parse(packageJsonRaw) as {
      dependencies?: Record<string, string>;
      devDependencies?: Record<string, string>;
    };

    const allDeps = { ...(parsed.dependencies ?? {}), ...(parsed.devDependencies ?? {}) };
    const risky = Object.entries(allDeps).filter(([, version]) => /^(?:\*|latest|next)$/i.test(version) || /^\^?0\./.test(version));

    if (risky.length === 0) return [];

    return [
      {
        id: nextId(),
        severity: risky.length > 8 ? "medium" : "low",
        title: `Potentially stale or unstable dependencies (${risky.length})`,
        description:
          "Several dependencies use potentially unstable or hard-to-track ranges (e.g. 0.x, latest, *), which increases maintenance risk.",
        domain: "tech-debt",
        rule: "dependency-staleness-risk",
        confidence: 0.75,
        evidence: risky.slice(0, 3).map(([name, version]) => ({ file: "package.json", snippet: `${name}: ${version}` })),
        recommendation: "Pin or regularly review versions and automate update checks in CI.",
        effort: "small",
        tags: ["dependencies", "staleness"],
        source: "tool",
      },
    ];
  } catch {
    return [];
  }
}


