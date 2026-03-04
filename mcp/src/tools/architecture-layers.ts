import { readFile } from "node:fs/promises";
import { relative } from "node:path";
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

export function extractImports(content: string): string[] {
  const importRegex = /(?:import|from)\s+['"]([^'"]+)['"]/g;
  const matches: string[] = [];
  let match: RegExpExecArray | null;
  while ((match = importRegex.exec(content)) !== null) {
    matches.push(match[1] ?? "");
  }
  return matches;
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
