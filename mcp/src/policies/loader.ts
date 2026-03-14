/**
 * Barrel re-export for the policies layer.
 * All existing imports from `policies/loader.js` continue to work unchanged.
 */

// ─── Imports (single import per module) ──────────────────────────────────────
import type { GradeConfig, ScoringConfig, ProfileConfig, SecurityPatternOverride } from "../types.js";
import { DEFAULT_SCORING, loadScoringRules } from "./scoring.js";
import {
  DEFAULT_CONFIDENCE,
  loadConfidenceRules,
  type ConfidenceAdjustment,
  type ConfidenceConfig,
} from "./confidence.js";
import { loadDeduplicationRules, type DeduplicationAlias, type DeduplicationConfig } from "./deduplication.js";
import { loadProfile, detectProfile } from "./profile.js";
import { loadSeverityMatrix, type SeverityMatrixLevel, type SeverityMatrixConfig } from "./severity-matrix.js";
import { loadRootCausePatterns, type RootCausePattern, type RootCauseCategory } from "./root-cause.js";
import type { IgnoreRule } from "../utils/ignore.js";

// ─── Re-exports ─────────────────────────────────────────────────────────────────────────────────
export type { IgnoreRule };
export type { GradeConfig, ScoringConfig, ProfileConfig, SecurityPatternOverride };
export { DEFAULT_SCORING, loadScoringRules };
export { DEFAULT_CONFIDENCE, loadConfidenceRules };
export type { ConfidenceAdjustment, ConfidenceConfig };
export { loadDeduplicationRules };
export type { DeduplicationAlias, DeduplicationConfig };
export { loadProfile, detectProfile };
export { loadSeverityMatrix };
export type { SeverityMatrixLevel, SeverityMatrixConfig };
export { loadRootCausePatterns };
export type { RootCausePattern, RootCauseCategory };

// ─── MergeOptions ─────────────────────────────────────────────────────────────
export interface MergeOptions {
  scoring?: ScoringConfig;
  confidence?: ConfidenceConfig;
  deduplication?: DeduplicationConfig;
  profile?: ProfileConfig;
  severityMatrix?: SeverityMatrixConfig;
  /** Per-project suppress list loaded from .inspectraignore */
  ignoreRules?: IgnoreRule[];
}

// ─── loadAllPolicies ──────────────────────────────────────────────────────────
/**
 * Loads all policy configurations in parallel and returns them as a `MergeOptions` bundle.
 *
 * @param policiesDir - Absolute path to the policies directory.
 * @param profileName - Stack profile name (e.g. `"java-backend"`, `"generic"`).
 * @returns Combined `MergeOptions` with all resolved sub-configs.
 */
export async function loadAllPolicies(policiesDir: string, profileName: string): Promise<MergeOptions> {
  const [scoring, confidence, deduplication, profile, severityMatrix] = await Promise.all([
    loadScoringRules(policiesDir),
    loadConfidenceRules(policiesDir),
    loadDeduplicationRules(policiesDir),
    loadProfile(policiesDir, profileName),
    loadSeverityMatrix(policiesDir),
  ]);

  return { scoring, confidence, deduplication, profile, ...(severityMatrix ? { severityMatrix } : {}) };
}
