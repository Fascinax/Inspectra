import { join } from "node:path";
import type { ScoringConfig } from "../types.js";
import { loadYaml } from "./utils.js";

export const DEFAULT_SCORING: ScoringConfig = {
  severity_weights: { critical: 25, high: 15, medium: 8, low: 3, info: 0 },
  domain_weights: {
    security: 0.24,
    tests: 0.2,
    architecture: 0.16,
    conventions: 0.12,
    performance: 0.1,
    documentation: 0.08,
    "tech-debt": 0.1,
    accessibility: 0.08,
    "api-design": 0.07,
    observability: 0.06,
    i18n: 0.05,
    "ux-consistency": 0.06,
  },
};

/**
 * Loads and parses `scoring-rules.yml` from the given policies directory.
 * Falls back to `DEFAULT_SCORING` when the file is absent or malformed.
 *
 * @param policiesDir - Absolute path to the policies directory.
 * @returns Resolved `ScoringConfig`.
 */
export async function loadScoringRules(policiesDir: string): Promise<ScoringConfig> {
  const data = await loadYaml<Record<string, unknown>>(join(policiesDir, "scoring-rules.yml"));
  if (!data) return DEFAULT_SCORING;

  const rawGrades = data.grades as Record<string, Record<string, unknown>> | undefined;
  const grades = rawGrades
    ? Object.fromEntries(
        Object.entries(rawGrades).map(([letter, config]) => [
          letter,
          {
            min_score: (config.min_score as number) ?? 0,
            label: (config.label as string) ?? letter,
            description: (config.description as string) ?? "",
          },
        ]),
      )
    : undefined;

  return {
    severity_weights: (data.severity_weights as Record<string, number>) ?? DEFAULT_SCORING.severity_weights,
    domain_weights: (data.domain_weights as Record<string, number>) ?? DEFAULT_SCORING.domain_weights,
    grades,
  };
}
