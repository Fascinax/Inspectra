import { join } from "node:path";
import { loadYaml } from "./utils.js";

export interface SeverityMatrixLevel {
  description: string;
  sla_days: number | null;
}

export interface SeverityMatrixConfig {
  severity_defaults: Record<string, SeverityMatrixLevel>;
}

/**
 * Loads and parses `severity-matrix.yml`. Returns `null` when the file is absent.
 *
 * @param policiesDir - Absolute path to the policies directory.
 * @returns Resolved `SeverityMatrixConfig` or `null`.
 */
export async function loadSeverityMatrix(policiesDir: string): Promise<SeverityMatrixConfig | null> {
  const data = await loadYaml<Record<string, unknown>>(join(policiesDir, "severity-matrix.yml"));
  if (!data) return null;

  const rawDefaults = data.severity_defaults as Record<string, Record<string, unknown>> | undefined;
  if (!rawDefaults) return null;

  const severity_defaults: Record<string, SeverityMatrixLevel> = {};
  for (const [level, config] of Object.entries(rawDefaults)) {
    severity_defaults[level] = {
      description: (config.description as string) ?? "",
      sla_days: config.sla_days != null ? (config.sla_days as number) : null,
    };
  }

  return { severity_defaults };
}
