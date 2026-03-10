import { readFile } from "node:fs/promises";
import { extname, relative } from "node:path";
import type { Finding, ProfileConfig } from "../types.js";
import { collectSourceFiles } from "../utils/files.js";
import { createIdSequence } from "../utils/id.js";
import { extractModuleSpecifiers } from "../utils/ast.js";
import { getImportResolver } from "../strategies/import-resolvers.js";

const LAYER_ORDER = ["presentation", "application", "domain", "infrastructure"] as const;

const LAYER_PATTERNS: Record<string, RegExp> = {
  presentation: /\/(controller|resource|handler|view|component|page)s?\//i,
  application: /\/(service|usecase|facade|orchestrator)s?\//i,
  domain: /\/(models?|entit(?:y|ies)|domain|aggregates?|value-?objects?)\//i,
  infrastructure: /\/(repositor(?:y|ies)|adapters?|gateways?|clients?|config|persistence)\//i,
};

/**
 * Builds a layer-detection pattern map from profile-defined layer names,
 * merging them into the default LAYER_PATTERNS.
 */
function buildLayerPatterns(profileLayers?: string[]): Record<string, RegExp> {
  if (!profileLayers || profileLayers.length === 0) return LAYER_PATTERNS;
  const custom: Record<string, RegExp> = {};
  for (const layer of profileLayers) {
    // Each profile layer name is also treated as a directory segment to match
    const escaped = layer.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    custom[layer] = new RegExp(`\\/${escaped}s?\/`, "i");
  }
  // Profile patterns take priority; fall back to built-ins for unspecified layers
  return { ...LAYER_PATTERNS, ...custom };
}

/**
 * Verifies clean architecture layer boundaries in the project's source files.
 * Flags imports that violate the allowed dependency direction.
 * When a `profile` is supplied its `architecture.layers` and
 * `architecture.allowed_dependencies` are used to override the defaults.
 */
export async function checkLayering(
  projectDir: string,
  allowedDependencies?: Record<string, string[]>,
  profile?: ProfileConfig,
): Promise<Finding[]> {
  const findings: Finding[] = [];
  const nextId = createIdSequence("ARC");

  // Profile-derived overrides (explicit params take precedence)
  const effectiveAllowed = allowedDependencies ?? profile?.architecture?.allowed_dependencies;
  const layerPatterns = buildLayerPatterns(profile?.architecture?.layers);

  const files = await collectSourceFiles(projectDir, undefined, undefined);

  for (const filePath of files) {
    const sourceLayer = detectLayer(filePath, layerPatterns);
    if (!sourceLayer) continue;

    try {
      const content = await readFile(filePath, "utf-8");
      const ext = extname(filePath);
      const importPaths = extractImports(content, ext);
      const resolver = getImportResolver(ext);

      for (const rawImp of importPaths) {
        const imp = resolver
          ? resolver.normalizeForLayerDetection(rawImp)
          : rawImp;
        const targetLayer = detectLayer(imp, layerPatterns);
        if (!targetLayer) continue;

        if (isViolation(sourceLayer, targetLayer, effectiveAllowed)) {
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
            source: "tool",
          });
        }
      }
    } catch {
      /* skip unreadable */
    }
  }

  return findings;
}

export function extractImports(content: string, fileExt = ".ts"): string[] {
  return extractModuleSpecifiers(content, fileExt);
}

function detectLayer(filePath: string, patterns: Record<string, RegExp> = LAYER_PATTERNS): string | undefined {
  const normalized = filePath.replace(/\\/g, "/");
  for (const [layer, pattern] of Object.entries(patterns)) {
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
