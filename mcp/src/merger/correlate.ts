import { basename, dirname } from "node:path";
import { SEVERITY_RANK, type Finding, type Severity } from "../types.js";

export type HotspotType = "file" | "module" | "dependency" | "pattern";

export interface Hotspot {
  type: HotspotType;
  /** Canonical key: file path, module dir, dep manifest path, or rule id. */
  key: string;
  /** Human-readable label for display. */
  label: string;
  finding_count: number;
  domain_count: number;
  domains: string[];
  /** Highest severity present in the hotspot. */
  severity_ceiling: Severity;
  findings: Finding[];
}

export interface CorrelationResult {
  hotspots: Hotspot[];
  total: number;
  metadata: {
    input_findings: number;
    file_hotspots: number;
    module_hotspots: number;
    dependency_hotspots: number;
    pattern_hotspots: number;
  };
}

const FILE_HOTSPOT_MIN_FINDINGS = 3;
const FILE_HOTSPOT_MIN_DOMAINS = 2;
const MODULE_HOTSPOT_MIN_FINDINGS = 5;
const MODULE_HOTSPOT_MIN_FILES = 2;
const PATTERN_HOTSPOT_MIN_FINDINGS = 5;
const PATTERN_HOTSPOT_MIN_FILES = 2;
const DEPENDENCY_HOTSPOT_MIN_FINDINGS = 2;
const DEPENDENCY_HOTSPOT_MIN_DOMAINS = 2;

const DEPENDENCY_MANIFEST_PATTERN =
  /(?:package\.json|pom\.xml|build\.gradle(?:\.kts)?|requirements\.txt|go\.mod|Cargo\.toml)$/i;

/**
 * Groups audit findings into four types of hotspots:
 * - **file**: 3+ findings from 2+ domains on the same file
 * - **module**: 5+ findings across 2+ files in a shared directory
 * - **dependency**: 2+ findings from 2+ domains on the same dependency manifest
 * - **pattern**: the same rule triggered 5+ times across 2+ different files
 *
 * Results are sorted by severity ceiling (highest first), then by finding count.
 */
export function detectHotspots(findings: ReadonlyArray<Finding>): CorrelationResult {
  const fileHotspots = detectFileHotspots(findings);
  const moduleHotspots = detectModuleHotspots(findings);
  const dependencyHotspots = detectDependencyHotspots(findings);
  const patternHotspots = detectPatternHotspots(findings);

  const hotspots = [...fileHotspots, ...moduleHotspots, ...dependencyHotspots, ...patternHotspots].sort((a, b) => {
    const sevDiff = SEVERITY_RANK[b.severity_ceiling] - SEVERITY_RANK[a.severity_ceiling];
    return sevDiff !== 0 ? sevDiff : b.finding_count - a.finding_count;
  });

  return {
    hotspots,
    total: hotspots.length,
    metadata: {
      input_findings: findings.length,
      file_hotspots: fileHotspots.length,
      module_hotspots: moduleHotspots.length,
      dependency_hotspots: dependencyHotspots.length,
      pattern_hotspots: patternHotspots.length,
    },
  };
}

function primaryFile(finding: Finding): string {
  return finding.evidence[0]?.file ?? "";
}

function severityCeiling(findings: Finding[]): Severity {
  return findings.reduce<Severity>(
    (max, f) => (SEVERITY_RANK[f.severity] > SEVERITY_RANK[max] ? f.severity : max),
    "info",
  );
}

function buildHotspot(type: HotspotType, key: string, label: string, findings: Finding[]): Hotspot {
  const domains = [...new Set(findings.map((f) => f.domain))];
  return {
    type,
    key,
    label,
    finding_count: findings.length,
    domain_count: domains.length,
    domains,
    severity_ceiling: severityCeiling(findings),
    findings,
  };
}

function groupByKey<T>(items: ReadonlyArray<T>, getKey: (item: T) => string): Map<string, T[]> {
  const groups = new Map<string, T[]>();
  for (const item of items) {
    const key = getKey(item);
    if (!key) continue;
    const group = groups.get(key) ?? [];
    group.push(item);
    groups.set(key, group);
  }
  return groups;
}

function detectFileHotspots(findings: ReadonlyArray<Finding>): Hotspot[] {
  const groups = groupByKey(findings, primaryFile);
  const hotspots: Hotspot[] = [];
  for (const [file, group] of groups) {
    const domainCount = new Set(group.map((f) => f.domain)).size;
    if (group.length >= FILE_HOTSPOT_MIN_FINDINGS && domainCount >= FILE_HOTSPOT_MIN_DOMAINS) {
      hotspots.push(buildHotspot("file", file, `File hotspot: ${basename(file)}`, group));
    }
  }
  return hotspots;
}

function detectModuleHotspots(findings: ReadonlyArray<Finding>): Hotspot[] {
  const groups = groupByKey(findings, (f) => {
    const file = primaryFile(f);
    if (!file) return "";
    const dir = dirname(file);
    return dir === "." ? "" : dir;
  });

  const hotspots: Hotspot[] = [];
  for (const [dir, group] of groups) {
    const fileCount = new Set(group.map(primaryFile)).size;
    if (group.length >= MODULE_HOTSPOT_MIN_FINDINGS && fileCount >= MODULE_HOTSPOT_MIN_FILES) {
      hotspots.push(buildHotspot("module", dir, `Module hotspot: ${basename(dir) || dir}`, group));
    }
  }
  return hotspots;
}

function detectDependencyHotspots(findings: ReadonlyArray<Finding>): Hotspot[] {
  const groups = groupByKey(findings, (f) => {
    const file = primaryFile(f);
    return DEPENDENCY_MANIFEST_PATTERN.test(file) ? file : "";
  });

  const hotspots: Hotspot[] = [];
  for (const [file, group] of groups) {
    const domainCount = new Set(group.map((f) => f.domain)).size;
    if (group.length >= DEPENDENCY_HOTSPOT_MIN_FINDINGS && domainCount >= DEPENDENCY_HOTSPOT_MIN_DOMAINS) {
      hotspots.push(buildHotspot("dependency", file, `Dependency hotspot: ${basename(file)}`, group));
    }
  }
  return hotspots;
}

function detectPatternHotspots(findings: ReadonlyArray<Finding>): Hotspot[] {
  const groups = groupByKey(findings, (f) => f.rule);

  const hotspots: Hotspot[] = [];
  for (const [rule, group] of groups) {
    const fileCount = new Set(group.map(primaryFile)).size;
    if (group.length >= PATTERN_HOTSPOT_MIN_FINDINGS && fileCount >= PATTERN_HOTSPOT_MIN_FILES) {
      hotspots.push(buildHotspot("pattern", rule, `Pattern hotspot: ${rule} (${group.length}×)`, group));
    }
  }
  return hotspots;
}
