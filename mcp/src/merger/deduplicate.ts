import { SEVERITY_RANK, type Finding } from "../types.js";
import type { DeduplicationConfig, DeduplicationAlias } from "../policies/loader.js";

export function deduplicateFindings(findings: ReadonlyArray<Finding>, config?: DeduplicationConfig): Finding[] {
  const aliases = config?.cross_domain_aliases ?? [];
  const strategy = config?.strategy ?? "same-rule-same-location";
  const onConflict = config?.on_conflict ?? "keep highest confidence";

  const aliasMap = buildAliasMap(aliases);
  const seen = new Map<string, Finding>();
  const preferredDomains = new Map<string, string>();

  for (const finding of findings) {
    const { resolved, keepDomain } = resolveAlias(finding, aliasMap);
    const key = buildDeduplicationKey(resolved, strategy);
    const existing = seen.get(key);

    if (!existing) {
      seen.set(key, resolved);
      if (keepDomain) preferredDomains.set(key, keepDomain);
    } else {
      const preferred = preferredDomains.get(key);
      if (shouldReplace(resolved, existing, preferred, onConflict)) {
        seen.set(key, resolved);
      }
    }
  }

  return Array.from(seen.values());
}

type AliasEntry = {
  canonical: string;
  keep_domain: string;
};

function buildAliasMap(aliases: DeduplicationAlias[]): Map<string, AliasEntry> {
  const map = new Map<string, AliasEntry>();
  for (const alias of aliases) {
    for (const rule of alias.rules) {
      map.set(rule, { canonical: alias.canonical, keep_domain: alias.keep_domain });
    }
  }
  return map;
}

function resolveAlias(finding: Finding, aliasMap: Map<string, AliasEntry>): { resolved: Finding; keepDomain?: string } {
  const alias = aliasMap.get(finding.rule);
  if (!alias) return { resolved: finding };
  return { resolved: { ...finding, rule: alias.canonical }, keepDomain: alias.keep_domain };
}

function buildDeduplicationKey(finding: Finding, strategy: string): string {
  const rule = finding.rule;
  const file = finding.evidence?.[0]?.file ?? "no-file";
  const line = finding.evidence?.[0]?.line ?? 0;

  switch (strategy) {
    case "same-rule-same-file":
      return `${rule}::${file}`;
    case "same-rule-any-location":
      return rule;
    case "same-rule-same-location":
    default:
      return `${rule}::${file}:${line}`;
  }
}

function shouldReplace(
  candidate: Finding,
  existing: Finding,
  preferredDomain: string | undefined,
  onConflict: string,
): boolean {
  if (preferredDomain) {
    const candidateIsPreferred = candidate.domain === preferredDomain;
    const existingIsPreferred = existing.domain === preferredDomain;
    if (candidateIsPreferred && !existingIsPreferred) return true;
    if (existingIsPreferred && !candidateIsPreferred) return false;
  }
  return hasHigherPriority(candidate, existing, onConflict);
}

function hasHigherPriority(candidate: Finding, existing: Finding, onConflict: string): boolean {
  if (onConflict === "keep highest severity") {
    const candidateRank = SEVERITY_RANK[candidate.severity] ?? 0;
    const existingRank = SEVERITY_RANK[existing.severity] ?? 0;
    if (candidateRank !== existingRank) return candidateRank > existingRank;
    return candidate.confidence > existing.confidence;
  }
  return candidate.confidence > existing.confidence;
}
