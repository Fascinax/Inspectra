import { join } from "node:path";
import { loadYaml } from "./utils.js";

export type RootCauseCategory =
  | "god-module"
  | "missing-abstraction"
  | "dependency-rot"
  | "test-gap"
  | "convention-drift"
  | "misaligned-architecture"
  | "security-shortcut"
  | "documentation-debt"
  | "isolated";

export const ROOT_CAUSE_CATEGORIES = [
  "god-module",
  "missing-abstraction",
  "dependency-rot",
  "test-gap",
  "convention-drift",
  "misaligned-architecture",
  "security-shortcut",
  "documentation-debt",
  "isolated",
] as const satisfies readonly RootCauseCategory[];

export interface RootCausePattern {
  category: RootCauseCategory;
  confidence?: number;
  rationale?: string;
  any_rules?: string[];
  any_domains?: string[];
  hotspot_types?: string[];
  min_findings?: number;
  min_domains?: number;
}

interface RootCausePatternsFile {
  version?: number;
  patterns?: RootCausePattern[];
}

/**
 * Loads root-cause inference patterns from policies/root-cause-patterns.yml.
 * Returns an empty list when the file is missing or invalid.
 */
export async function loadRootCausePatterns(policiesDir: string): Promise<RootCausePattern[]> {
  const filePath = join(policiesDir, "root-cause-patterns.yml");
  const parsed = await loadYaml<RootCausePatternsFile>(filePath);
  if (!parsed || !Array.isArray(parsed.patterns)) {
    return [];
  }

  return parsed.patterns.filter(
    (pattern): pattern is RootCausePattern =>
      typeof pattern?.category === "string" && pattern.category.length > 0,
  );
}
