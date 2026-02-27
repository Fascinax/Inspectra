import type { Finding } from "../types.js";

export function deduplicateFindings(findings: Finding[]): Finding[] {
  const seen = new Map<string, Finding>();

  for (const finding of findings) {
    const key = buildDeduplicationKey(finding);
    const existing = seen.get(key);

    if (!existing || hasHigherPriority(finding, existing)) {
      seen.set(key, finding);
    }
  }

  return Array.from(seen.values());
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
