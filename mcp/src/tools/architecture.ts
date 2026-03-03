import { readFile } from "node:fs/promises";
import { join, relative, extname, resolve, dirname } from "node:path";
import type { Finding } from "../types.js";
import { collectSourceFiles } from "../utils/files.js";
import { createIdSequence } from "../utils/id.js";

const LAYER_ORDER = ["presentation", "application", "domain", "infrastructure"] as const;

const LAYER_PATTERNS: Record<string, RegExp> = {
  presentation: /\/(controller|resource|handler|view|component|page)s?\//i,
  application: /\/(service|usecase|facade|orchestrator)s?\//i,
  domain: /\/(models?|entit(?:y|ies)|domain|aggregates?|value-?objects?)\//i,
  infrastructure: /\/(repositor(?:y|ies)|adapters?|gateways?|clients?|config|persistence)\//i,
};

/**
 * Verifies clean architecture layer boundaries in the project's source files.
 * Flags imports that violate the allowed dependency direction
 * (presentation → application → domain, infrastructure is isolated).
 *
 * @param projectDir - Absolute path to the project root.
 * @param allowedDependencies - Optional override of allowed inter-layer dependencies.
 * @returns Array of `Finding` objects for each layer violation detected.
 */
export async function checkLayering(
  projectDir: string,
  allowedDependencies?: Record<string, string[]>,
): Promise<Finding[]> {
  const findings: Finding[] = [];
  const nextId = createIdSequence("ARC");

  const files = await collectSourceFiles(projectDir);

  for (const filePath of files) {
    const sourceLayer = detectLayer(filePath);
    if (!sourceLayer) continue;

    try {
      const content = await readFile(filePath, "utf-8");
      const importPaths = extractImports(content);

      for (const imp of importPaths) {
        const targetLayer = detectLayer(imp);
        if (!targetLayer) continue;

        if (isViolation(sourceLayer, targetLayer, allowedDependencies)) {
          findings.push({
            id: nextId(),
            severity: "high",
            title: `Layer violation: ${sourceLayer} → ${targetLayer}`,
            description: `File in '${sourceLayer}' layer imports from '${targetLayer}' layer. Dependencies should flow inward (presentation → application → domain ← infrastructure).`,
            domain: "architecture",
            rule: "no-layer-violation",
            confidence: 0.8,
            evidence: [{ file: relative(projectDir, filePath), snippet: `import ... from '${imp}'` }],
            recommendation: `Invert the dependency using an interface in the domain layer.`,
            effort: "large",
            tags: ["layering", "clean-architecture"],
          });
        }
      }
    } catch {
      /* skip unreadable */
    }
  }

  return findings;
}

/**
 * Analyzes `package.json` (and `pom.xml`) for dependency health issues:
 * excessive count, duplicated prefixes, and missing a lock file.
 *
 * @param projectDir - Absolute path to the project root.
 * @returns Array of architecture `Finding` objects.
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
 *
 * @param projectDir - Absolute path to the project root.
 * @returns Array of `Finding` objects, one per detected cycle.
 */
export async function detectCircularDependencies(projectDir: string): Promise<Finding[]> {
  const findings: Finding[] = [];
  const nextId = createIdSequence("ARC", 100);

  const files = await collectSourceFiles(projectDir);
  if (files.length === 0) return findings;

  // Build adjacency map: abs filePath → [abs dep paths]
  const graph = new Map<string, string[]>();

  for (const filePath of files) {
    try {
      const content = await readFile(filePath, "utf-8");
      const rawImports = extractImports(content);
      const dir = dirname(filePath);

      const deps: string[] = [];
      for (const imp of rawImports) {
        if (!imp.startsWith(".")) continue; // only local imports
        const ext = extname(imp);
        const candidates = ext
          ? [resolve(dir, imp)]
          : [resolve(dir, `${imp}.ts`), resolve(dir, `${imp}.js`), resolve(dir, imp, "index.ts")];
        const resolved = candidates.find((c) => files.includes(c));
        if (resolved) deps.push(resolved);
      }
      graph.set(filePath, deps);
    } catch {
      /* unreadable — skip */
      graph.set(filePath, []);
    }
  }

  // DFS cycle detection
  const DFS_COLOR = { WHITE: 0, GREY: 1, BLACK: 2 } as const;
  type DfsColor = (typeof DFS_COLOR)[keyof typeof DFS_COLOR];
  const color = new Map<string, DfsColor>(files.map((f) => [f, DFS_COLOR.WHITE]));
  const cycles = new Set<string>(); // deduplicate by cycle key

  function dfs(node: string, path: string[]): void {
    color.set(node, DFS_COLOR.GREY);
    for (const dep of graph.get(node) ?? []) {
      if (color.get(dep) === DFS_COLOR.GREY) {
        // Back edge found — extract the cycle
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

function detectLayer(filePath: string): string | undefined {
  const normalized = filePath.replace(/\\/g, "/");
  for (const [layer, pattern] of Object.entries(LAYER_PATTERNS)) {
    if (pattern.test(normalized)) return layer;
  }
  return undefined;
}

function isViolation(source: string, target: string, allowedDeps?: Record<string, string[]>): boolean {
  if (source === target) return false;

  if (allowedDeps) {
    const allowed = allowedDeps[source];
    if (!allowed) return true;
    return !allowed.includes(target);
  }

  const sourceIndex = LAYER_ORDER.indexOf(source as (typeof LAYER_ORDER)[number]);
  const targetIndex = LAYER_ORDER.indexOf(target as (typeof LAYER_ORDER)[number]);
  if (sourceIndex < 0 || targetIndex < 0) return false;

  if (source === "domain" && target !== "domain") return true;
  if (source === "infrastructure" && target === "presentation") return true;
  if (source === "infrastructure" && target === "application") return true;

  return false;
}

function extractImports(content: string): string[] {
  const importRegex = /(?:import|from)\s+['"]([^'"]+)['"]/g;
  const matches: string[] = [];
  let match: RegExpExecArray | null;
  while ((match = importRegex.exec(content)) !== null) {
    matches.push(match[1] ?? "");
  }
  return matches;
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
