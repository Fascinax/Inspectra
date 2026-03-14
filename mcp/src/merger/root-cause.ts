import { SEVERITY_RANK, type Domain, type Severity } from "../types.js";
import type { Hotspot } from "./correlate.js";
import type { RootCauseCategory, RootCausePattern } from "../policies/root-cause.js";

export interface RootCauseCluster {
  category: RootCauseCategory;
  source: "tool" | "llm";
  confidence: number;
  rationale: string;
  hotspot_count: number;
  finding_count: number;
  domain_count: number;
  domains: Domain[];
  severity_ceiling: Severity;
  hotspots: Hotspot[];
}

export interface RootCauseInferenceResult {
  clusters: RootCauseCluster[];
  total: number;
  metadata: {
    input_hotspots: number;
    matched_with_rules: number;
    llm_fallback_count: number;
  };
}

interface HotspotInference {
  category: RootCauseCategory;
  source: "tool" | "llm";
  confidence: number;
  rationale: string;
  hotspot: Hotspot;
}

const FALLBACK_CATEGORY: RootCauseCategory = "isolated";
const LLM_FALLBACK_CONFIDENCE = 0.6;

/**
 * Infers root-cause clusters from correlated hotspots using rule-based patterns.
 * Unmatched hotspots are assigned to the "isolated" category with llm fallback confidence.
 */
export function inferRootCauseClusters(
  hotspots: ReadonlyArray<Hotspot>,
  patterns: ReadonlyArray<RootCausePattern>,
): RootCauseInferenceResult {
  const inferred = hotspots.map((hotspot) => inferHotspot(hotspot, patterns));
  const grouped = new Map<RootCauseCategory, HotspotInference[]>();

  for (const item of inferred) {
    const current = grouped.get(item.category) ?? [];
    current.push(item);
    grouped.set(item.category, current);
  }

  const clusters = Array.from(grouped.entries())
    .map(([category, group]) => buildCluster(category, group))
    .sort((a, b) => {
      const sevDiff = SEVERITY_RANK[b.severity_ceiling] - SEVERITY_RANK[a.severity_ceiling];
      if (sevDiff !== 0) return sevDiff;
      return b.finding_count - a.finding_count;
    });

  const matchedWithRules = inferred.filter((item) => item.source === "tool").length;

  return {
    clusters,
    total: clusters.length,
    metadata: {
      input_hotspots: hotspots.length,
      matched_with_rules: matchedWithRules,
      llm_fallback_count: hotspots.length - matchedWithRules,
    },
  };
}

function inferHotspot(
  hotspot: Hotspot,
  patterns: ReadonlyArray<RootCausePattern>,
): HotspotInference {
  for (const pattern of patterns) {
    if (matchesPattern(hotspot, pattern)) {
      const confidence = Math.min(0.95, pattern.confidence ?? 0.8);
      return {
        category: pattern.category,
        source: "tool",
        confidence,
        rationale: pattern.rationale ?? `Pattern matched for category ${pattern.category}.`,
        hotspot,
      };
    }
  }

  return {
    category: FALLBACK_CATEGORY,
    source: "llm",
    confidence: LLM_FALLBACK_CONFIDENCE,
    rationale: "No deterministic root-cause pattern matched this hotspot.",
    hotspot,
  };
}

function matchesPattern(hotspot: Hotspot, pattern: RootCausePattern): boolean {
  if (pattern.hotspot_types && pattern.hotspot_types.length > 0 && !pattern.hotspot_types.includes(hotspot.type)) {
    return false;
  }

  if (typeof pattern.min_findings === "number" && hotspot.finding_count < pattern.min_findings) {
    return false;
  }

  if (typeof pattern.min_domains === "number" && hotspot.domain_count < pattern.min_domains) {
    return false;
  }

  if (pattern.any_domains && pattern.any_domains.length > 0) {
    const hasDomainMatch = pattern.any_domains.some((domain) => hotspot.domains.includes(domain));
    if (!hasDomainMatch) {
      return false;
    }
  }

  if (pattern.any_rules && pattern.any_rules.length > 0) {
    const rules = new Set(hotspot.findings.map((finding) => finding.rule));
    const hasRuleMatch = pattern.any_rules.some((rule) => rules.has(rule));
    if (!hasRuleMatch) {
      return false;
    }
  }

  return true;
}

function buildCluster(
  category: RootCauseCategory,
  inferred: ReadonlyArray<HotspotInference>,
): RootCauseCluster {
  const hotspots = inferred.map((item) => item.hotspot);
  const domains = new Set<Domain>();
  const rationales = new Map<string, number>();

  for (const item of inferred) {
    for (const domain of item.hotspot.domains) {
      domains.add(domain as Domain);
    }
    rationales.set(item.rationale, (rationales.get(item.rationale) ?? 0) + 1);
  }

  const dominantRationale = Array.from(rationales.entries()).sort((a, b) => b[1] - a[1])[0]?.[0] ?? "";

  const source = inferred.some((item) => item.source === "llm") ? "llm" : "tool";
  const confidence = Number(
    (inferred.reduce((sum, item) => sum + item.confidence, 0) / Math.max(inferred.length, 1)).toFixed(2),
  );

  return {
    category,
    source,
    confidence,
    rationale: dominantRationale,
    hotspot_count: hotspots.length,
    finding_count: hotspots.reduce((sum, hotspot) => sum + hotspot.finding_count, 0),
    domain_count: domains.size,
    domains: [...domains],
    severity_ceiling: severityCeiling(hotspots),
    hotspots,
  };
}

function severityCeiling(hotspots: ReadonlyArray<Hotspot>): Severity {
  return hotspots.reduce<Severity>(
    (max, hotspot) =>
      SEVERITY_RANK[hotspot.severity_ceiling] > SEVERITY_RANK[max]
        ? hotspot.severity_ceiling
        : max,
    "info",
  );
}
