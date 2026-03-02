import { join } from "node:path";
import { loadYaml } from "./utils.js";

export interface ConfidenceAdjustment {
  condition: string;
  description: string;
  delta: number;
}

export interface ConfidenceConfig {
  minimum_for_report: number;
  minimum_for_pr_comment: number;
  auto_dismiss_below: number;
  adjustments?: ConfidenceAdjustment[];
  tool_floors?: Record<string, number>;
}

export const DEFAULT_CONFIDENCE: ConfidenceConfig = {
  minimum_for_report: 0.3,
  minimum_for_pr_comment: 0.7,
  auto_dismiss_below: 0.2,
};

/**
 * Loads and parses `confidence-rules.yml`. Falls back to `DEFAULT_CONFIDENCE` when absent.
 *
 * @param policiesDir - Absolute path to the policies directory.
 * @returns Resolved `ConfidenceConfig`.
 */
export async function loadConfidenceRules(policiesDir: string): Promise<ConfidenceConfig> {
  const data = await loadYaml<Record<string, unknown>>(join(policiesDir, "confidence-rules.yml"));
  if (!data) return DEFAULT_CONFIDENCE;

  const rawAdjustments = data.adjustments as Array<Record<string, unknown>> | undefined;
  const adjustments = rawAdjustments?.map((a) => ({
    condition: (a.condition as string) ?? "",
    description: (a.description as string) ?? "",
    delta: (a.delta as number) ?? 0,
  }));

  return {
    minimum_for_report: (data.minimum_for_report as number) ?? DEFAULT_CONFIDENCE.minimum_for_report,
    minimum_for_pr_comment: (data.minimum_for_pr_comment as number) ?? DEFAULT_CONFIDENCE.minimum_for_pr_comment,
    auto_dismiss_below: (data.auto_dismiss_below as number) ?? DEFAULT_CONFIDENCE.auto_dismiss_below,
    adjustments,
    tool_floors: (data.tool_floors as Record<string, number>) ?? undefined,
  };
}
