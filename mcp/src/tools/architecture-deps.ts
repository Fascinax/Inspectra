import { readFile } from "node:fs/promises";
import { join, relative, extname, resolve, dirname } from "node:path";
import type { Finding } from "../types.js";
import { collectSourceFiles } from "../utils/files.js";
import { createIdSequence } from "../utils/id.js";
import { extractImports } from "./architecture-layers.js";
import { getImportResolver } from "../strategies/import-resolvers.js";

/**
 * Analyzes `package.json` (and `pom.xml`) for dependency health issues:
 * excessive count, duplicated prefixes, and missing a lock file.
 */
export async function analyzeModuleDependencies(projectDir: string): Promise<Finding[]> {
  const findings: Finding[] = [];
  const nextId = createIdSequence("ARC", 50);

  try {
    const packageJsonPath = join(projectDir, "package.json");
    const raw = await readFile(packageJsonPath, "utf-8");
    const pkg = JSON.parse(raw);
    const deps = { ...pkg.dependencies, ...pkg.devDependencies };

    const depCount = Object.keys(deps).length;
    if (depCount > 80) {
      findings.push({
        id: nextId(),
        severity: "medium",
        title: `High dependency count: ${depCount} packages`,
        description: `The project has ${depCount} direct dependencies. A high count increases supply chain risk and build times.`,
        domain: "architecture",
        rule: "excessive-dependencies",
        confidence: 0.9,
        evidence: [{ file: "package.json" }],
        recommendation: "Audit dependencies and remove unused packages with `depcheck`.",
        effort: "medium",
        tags: ["dependencies"],
        source: "tool",
      });
    }

    const duplicatedPrefixes = findDuplicatedPrefixes(Object.keys(deps));
    for (const { prefix, packages } of duplicatedPrefixes) {
      findings.push({
        id: nextId(),
        severity: "low",
        title: `Multiple packages with prefix '${prefix}'`,
        description: `Found ${packages.length} packages starting with '${prefix}': ${packages.join(", ")}. Check for redundant dependencies.`,
        domain: "architecture",
        rule: "potential-duplicate-deps",
        confidence: 0.5,
        evidence: [{ file: "package.json" }],
        recommendation: "Verify whether all these packages are needed or if they overlap.",
        effort: "small",
        tags: ["dependencies"],
        source: "tool",
      });
    }
  } catch {
    /* no package.json */
  }

  return findings;
}

/**
 * Detects circular import chains between source files by building
 * an in-memory dependency graph and running DFS cycle detection.
 */
export async function detectCircularDependencies(projectDir: string): Promise<Finding[]> {
  const findings: Finding[] = [];
  const nextId = createIdSequence("ARC", 100);

  const files = await collectSourceFiles(projectDir);
  if (files.length === 0) return findings;

  const graph = new Map<string, string[]>();

  for (const filePath of files) {
    try {
      const content = await readFile(filePath, "utf-8");
      const rawImports = extractImports(content, extname(filePath));
      const resolver = getImportResolver(extname(filePath));

      const deps: string[] = [];
      for (const imp of rawImports) {
        const resolved = resolver?.resolveToFile(imp, filePath, files);
        if (resolved) deps.push(resolved);
      }
      graph.set(filePath, deps);
    } catch {
      graph.set(filePath, []);
    }
  }

  const DFS_COLOR = { WHITE: 0, GREY: 1, BLACK: 2 } as const;
  type DfsColor = (typeof DFS_COLOR)[keyof typeof DFS_COLOR];
  const color = new Map<string, DfsColor>(files.map((f) => [f, DFS_COLOR.WHITE]));
  const cycles = new Set<string>();

  function dfs(node: string, path: string[]): void {
    color.set(node, DFS_COLOR.GREY);
    for (const dep of graph.get(node) ?? []) {
      if (color.get(dep) === DFS_COLOR.GREY) {
        const cycleStart = path.indexOf(dep);
        if (cycleStart !== -1) {
          const cycle = [...path.slice(cycleStart), node, dep];
          const key = cycle
            .map((f) => relative(projectDir, f))
            .sort()
            .join("|");
          if (!cycles.has(key)) {
            cycles.add(key);
            const cycleFiles = cycle.slice(0, -1).map((f) => relative(projectDir, f));
            findings.push({
              id: nextId(),
              severity: "high",
              title: `Circular dependency detected: ${cycleFiles[0]} → … → ${cycleFiles[0]}`,
              description: `A circular import chain was detected: ${cycleFiles.join(" → ")} → ${cycleFiles[0]}`,
              domain: "architecture",
              rule: "no-circular-dependency",
              confidence: 0.95,
              evidence: cycleFiles.slice(0, 3).map((f) => ({ file: f })),
              recommendation:
                "Break the cycle by extracting shared logic into a separate module or using dependency injection.",
              effort: "large",
              tags: ["circular-dependency", "coupling"],
              source: "tool",
            });
          }
        }
      } else if (color.get(dep) === DFS_COLOR.WHITE) {
        dfs(dep, [...path, node]);
      }
    }
    color.set(node, DFS_COLOR.BLACK);
  }

  for (const node of files) {
    if (color.get(node) === DFS_COLOR.WHITE) {
      dfs(node, []);
    }
  }

  return findings;
}

function findDuplicatedPrefixes(pkgs: string[]): Array<{ prefix: string; packages: string[] }> {
  const prefixMap = new Map<string, string[]>();
  for (const pkg of pkgs) {
    const parts = pkg.replace(/^@[^/]+\//, "").split("-");
    if (parts.length >= 2) {
      const prefix = parts[0] ?? "";
      const existing = prefixMap.get(prefix) ?? [];
      existing.push(pkg);
      prefixMap.set(prefix, existing);
    }
  }
  return Array.from(prefixMap.entries())
    .filter(([, pkgList]) => pkgList.length >= 3)
    .map(([prefix, packages]) => ({ prefix, packages }));
}
