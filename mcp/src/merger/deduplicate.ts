import type { Finding } from "../types.js";
import type { DeduplicationAlias } from "../policies/loader.js";

export function deduplicateFindings(
  findings: Finding[],
  aliases?: DeduplicationAlias[],
): Finding[] {
  const aliasMap = buildAliasMap(aliases ?? []);
  const seen = new Map<string, Finding>();

  for (const finding of findings) {
    const resolved = resolveAlias(finding, aliasMap);
    const key = buildDeduplicationKey(resolved);
    const existing = seen.get(key);

    if (!existing || hasHigherPriority(resolved, existing)) {
      seen.set(key, resolved);
    }
  }

  return Array.from(seen.values());
}

interface AliasEntry {
  canonical: string;
  keep_domain: string;
}

function buildAliasMap(aliases: DeduplicationAlias[]): Map<string, AliasEntry> {
  const map = new Map<string, AliasEntry>();
  for (const alias of aliases) {
    for (const rule of alias.rules) {
      map.set(rule, { canonical: alias.canonical, keep_domain: alias.keep_domain });
    }
  }
  return map;
}

function resolveAlias(finding: Finding, aliasMap: Map<string, AliasEntry>): Finding {
  const alias = aliasMap.get(finding.rule);
  if (!alias) return finding;
  return { ...finding, rule: alias.canonical };
}

function buildDeduplicationKey(finding: Finding): string {
  const location = finding.evidence?.[0]
    ? `${finding.evidence[0].file}:${finding.evidence[0].line ?? 0}`
    : "no-location";
  return `${finding.rule}::${location}`;
}

function hasHigherPriority(candidate: Finding, existing: Finding): boolean {
  return candidate.confidence > existing.confidence;
}
