import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { parse as parseYaml } from "yaml";

export interface ScoringConfig {
  severity_weights: Record<string, number>;
  domain_weights: Record<string, number>;
}

export interface ConfidenceConfig {
  minimum_for_report: number;
  minimum_for_pr_comment: number;
  auto_dismiss_below: number;
}

export interface DeduplicationAlias {
  rules: string[];
  canonical: string;
  keep_domain: string;
}

export interface DeduplicationConfig {
  strategy: string;
  cross_domain_aliases: DeduplicationAlias[];
}

export interface ProfileConfig {
  profile: string;
  coverage?: {
    lines?: { minimum: number; target: number };
    branches?: { minimum: number; target: number };
    functions?: { minimum: number; target: number };
  };
  file_lengths?: {
    warning: number;
    error: number;
  };
  naming?: Record<string, Record<string, string>>;
  architecture?: {
    layers?: string[];
    allowed_dependencies?: Record<string, string[]>;
  };
}

export interface MergeOptions {
  scoring?: ScoringConfig;
  confidence?: ConfidenceConfig;
  deduplication?: DeduplicationConfig;
  profile?: ProfileConfig;
}

const DEFAULT_SCORING: ScoringConfig = {
  severity_weights: { critical: 25, high: 15, medium: 8, low: 3, info: 0 },
  domain_weights: {
    security: 0.30, tests: 0.25, architecture: 0.20,
    conventions: 0.15, performance: 0.05, documentation: 0.05,
  },
};

const DEFAULT_CONFIDENCE: ConfidenceConfig = {
  minimum_for_report: 0.3,
  minimum_for_pr_comment: 0.7,
  auto_dismiss_below: 0.2,
};

const DEFAULT_DEDUPLICATION: DeduplicationConfig = {
  strategy: "same-rule-same-location",
  cross_domain_aliases: [],
};

const DEFAULT_PROFILE: ProfileConfig = {
  profile: "generic",
  coverage: {
    lines: { minimum: 60, target: 80 },
    branches: { minimum: 50, target: 70 },
    functions: { minimum: 60, target: 80 },
  },
  file_lengths: { warning: 400, error: 800 },
};

async function loadYaml<T>(filePath: string): Promise<T | null> {
  try {
    const raw = await readFile(filePath, "utf-8");
    return parseYaml(raw) as T;
  } catch {
    return null;
  }
}

export async function loadScoringRules(policiesDir: string): Promise<ScoringConfig> {
  const data = await loadYaml<Record<string, unknown>>(join(policiesDir, "scoring-rules.yml"));
  if (!data) return DEFAULT_SCORING;

  return {
    severity_weights: (data.severity_weights as Record<string, number>) ?? DEFAULT_SCORING.severity_weights,
    domain_weights: (data.domain_weights as Record<string, number>) ?? DEFAULT_SCORING.domain_weights,
  };
}

export async function loadConfidenceRules(policiesDir: string): Promise<ConfidenceConfig> {
  const data = await loadYaml<Record<string, unknown>>(join(policiesDir, "confidence-rules.yml"));
  if (!data) return DEFAULT_CONFIDENCE;

  return {
    minimum_for_report: (data.minimum_for_report as number) ?? DEFAULT_CONFIDENCE.minimum_for_report,
    minimum_for_pr_comment: (data.minimum_for_pr_comment as number) ?? DEFAULT_CONFIDENCE.minimum_for_pr_comment,
    auto_dismiss_below: (data.auto_dismiss_below as number) ?? DEFAULT_CONFIDENCE.auto_dismiss_below,
  };
}

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
  };
}

export async function loadProfile(policiesDir: string, profileName: string): Promise<ProfileConfig> {
  const data = await loadYaml<Record<string, unknown>>(
    join(policiesDir, "profiles", `${profileName}.yml`),
  );
  if (!data) return DEFAULT_PROFILE;

  const coverage = data.coverage as Record<string, Record<string, number>> | undefined;
  const fileLengths = data.file_lengths as Record<string, number> | undefined;

  return {
    profile: profileName,
    coverage: coverage
      ? {
          lines: coverage.lines ? { minimum: coverage.lines.minimum, target: coverage.lines.target } : DEFAULT_PROFILE.coverage!.lines,
          branches: coverage.branches ? { minimum: coverage.branches.minimum, target: coverage.branches.target } : DEFAULT_PROFILE.coverage!.branches,
          functions: coverage.functions ? { minimum: coverage.functions.minimum, target: coverage.functions.target } : DEFAULT_PROFILE.coverage!.functions,
        }
      : DEFAULT_PROFILE.coverage,
    file_lengths: fileLengths
      ? { warning: fileLengths.warning ?? 400, error: fileLengths.error ?? 800 }
      : DEFAULT_PROFILE.file_lengths,
    naming: data.naming as Record<string, Record<string, string>> | undefined,
    architecture: data.architecture as ProfileConfig["architecture"] | undefined,
  };
}

export async function loadAllPolicies(policiesDir: string, profileName: string): Promise<MergeOptions> {
  const [scoring, confidence, deduplication, profile] = await Promise.all([
    loadScoringRules(policiesDir),
    loadConfidenceRules(policiesDir),
    loadDeduplicationRules(policiesDir),
    loadProfile(policiesDir, profileName),
  ]);

  return { scoring, confidence, deduplication, profile };
}

export { DEFAULT_SCORING, DEFAULT_CONFIDENCE, DEFAULT_DEDUPLICATION, DEFAULT_PROFILE };
