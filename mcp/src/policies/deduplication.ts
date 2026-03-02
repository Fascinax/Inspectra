import { join } from "node:path";
import { loadYaml } from "./utils.js";

export interface DeduplicationAlias {
  rules: string[];
  canonical: string;
  keep_domain: string;
}

export interface DeduplicationConfig {
  strategy: string;
  cross_domain_aliases: DeduplicationAlias[];
  on_conflict?: string;
  key_fields?: string[];
}

const DEFAULT_DEDUPLICATION: DeduplicationConfig = {
  strategy: "same-rule-same-location",
  cross_domain_aliases: [],
};

/**
 * Loads and parses `deduplication-rules.yml`. Falls back to a default config when absent.
 *
 * @param policiesDir - Absolute path to the policies directory.
 * @returns Resolved `DeduplicationConfig`.
 */
export async function loadDeduplicationRules(policiesDir: string): Promise<DeduplicationConfig> {
  const data = await loadYaml<Record<string, unknown>>(join(policiesDir, "deduplication-rules.yml"));
  if (!data) return DEFAULT_DEDUPLICATION;

  const rawAliases = (data.cross_domain_aliases ?? []) as Array<Record<string, unknown>>;
  const aliases: DeduplicationAlias[] = rawAliases.map((a) => ({
    rules: (a.rules as string[]) ?? [],
    canonical: (a.canonical as string) ?? "",
    keep_domain: (a.keep_domain as string) ?? "",
  }));

  return {
    strategy: (data.strategy as string) ?? DEFAULT_DEDUPLICATION.strategy,
    cross_domain_aliases: aliases,
    on_conflict: (data.on_conflict as string) ?? undefined,
    key_fields: (data.key_fields as string[]) ?? undefined,
  };
}
