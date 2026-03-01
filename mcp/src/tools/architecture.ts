import { readFile, readdir } from "node:fs/promises";
import { join, relative, extname } from "node:path";
import type { Finding } from "../types.js";

const LAYER_ORDER = ["presentation", "application", "domain", "infrastructure"] as const;

const LAYER_PATTERNS: Record<string, RegExp> = {
  presentation: /\/(controller|resource|handler|view|component|page)s?\//i,
  application: /\/(service|usecase|facade|orchestrator)s?\//i,
  domain: /\/(models?|entit(?:y|ies)|domain|aggregates?|value-?objects?)\//i,
  infrastructure: /\/(repositor(?:y|ies)|adapters?|gateways?|clients?|config|persistence)\//i,
};

export async function checkLayering(projectDir: string): Promise<Finding[]> {
  const findings: Finding[] = [];
  let counter = 1;

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

        if (isViolation(sourceLayer, targetLayer)) {
          findings.push({
            id: `ARC-${String(counter++).padStart(3, "0")}`,
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

export async function analyzeModuleDependencies(projectDir: string): Promise<Finding[]> {
  const findings: Finding[] = [];
  let counter = 50;

  try {
    const packageJsonPath = join(projectDir, "package.json");
    const raw = await readFile(packageJsonPath, "utf-8");
    const pkg = JSON.parse(raw);
    const deps = { ...pkg.dependencies, ...pkg.devDependencies };

    const depCount = Object.keys(deps).length;
    if (depCount > 80) {
      findings.push({
        id: `ARC-${String(counter++).padStart(3, "0")}`,
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
        id: `ARC-${String(counter++).padStart(3, "0")}`,
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

function detectLayer(filePath: string): string | undefined {
  const normalized = filePath.replace(/\\/g, "/");
  for (const [layer, pattern] of Object.entries(LAYER_PATTERNS)) {
    if (pattern.test(normalized)) return layer;
  }
  return undefined;
}

function isViolation(source: string, target: string): boolean {
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
    matches.push(match[1]);
  }
  return matches;
}

async function collectSourceFiles(dir: string, collected: string[] = []): Promise<string[]> {
  try {
    const entries = await readdir(dir, { withFileTypes: true });
    for (const entry of entries) {
      const fullPath = join(dir, entry.name);
      if (entry.name === "node_modules" || entry.name === "dist" || entry.name.startsWith(".")) continue;
      if (entry.isDirectory()) {
        await collectSourceFiles(fullPath, collected);
      } else if ([".ts", ".js", ".java"].includes(extname(entry.name))) {
        collected.push(fullPath);
      }
    }
  } catch {
    /* directory not readable */
  }
  return collected;
}

function findDuplicatedPrefixes(pkgs: string[]): Array<{ prefix: string; packages: string[] }> {
  const prefixMap = new Map<string, string[]>();
  for (const pkg of pkgs) {
    const parts = pkg.replace(/^@[^/]+\//, "").split("-");
    if (parts.length >= 2) {
      const prefix = parts[0];
      const existing = prefixMap.get(prefix) ?? [];
      existing.push(pkg);
      prefixMap.set(prefix, existing);
    }
  }
  return Array.from(prefixMap.entries())
    .filter(([, pkgList]) => pkgList.length >= 3)
    .map(([prefix, packages]) => ({ prefix, packages }));
}
