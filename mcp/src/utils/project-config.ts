import { readFile } from "node:fs/promises";
import { join, resolve } from "node:path";
import { existsSync } from "node:fs";
import { parse as parseYaml } from "yaml";
import type { Domain } from "../types.js";

// ─── Types ─────────────────────────────────────────────────────────────────────

export interface ProjectConfig {
  /** Stack profile to load (e.g. "angular-frontend", "java-backend") */
  profile?: string;
  /** Cyclomatic complexity threshold for tech-debt findings */
  complexity_threshold?: number;
  /** File length threshold (lines) for conventions findings */
  file_length_threshold?: number;
  /** Domains to exclude from the audit */
  exclude_domains?: Domain[];
  /** Custom severity overrides per rule ID */
  severity_overrides?: Record<string, "critical" | "high" | "medium" | "low" | "info">;
  /** Directories to ignore during scanning */
  ignore_dirs?: string[];
}

// ─── Loader ────────────────────────────────────────────────────────────────────

const CONFIG_FILENAMES = [".inspectrarc.yml", ".inspectrarc.yaml", "inspectra.config.yml"];

/**
 * Attempts to load an `.inspectrarc.yml` (or equivalent) from the given
 * project directory. Returns `{}` when no config file is found, so callers
 * can safely apply defaults without null-checks.
 */
export async function loadProjectConfig(projectDir: string): Promise<ProjectConfig> {
  const dir = resolve(projectDir);

  for (const filename of CONFIG_FILENAMES) {
    const candidate = join(dir, filename);
    if (!existsSync(candidate)) continue;

    try {
      const content = await readFile(candidate, "utf-8");
      const parsed = parseYaml(content) as unknown;

      if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed)) {
        return {};
      }

      return parsed as ProjectConfig;
    } catch {
      // Malformed YAML — return empty config so the audit still runs
      return {};
    }
  }

  return {};
}

/**
 * Merges a loaded project config with safe defaults.
 * Callers receive a fully-populated object they can destructure without
 * further null-checking.
 */
export function resolveConfig(config: ProjectConfig): Required<ProjectConfig> {
  return {
    profile: config.profile ?? "generic",
    complexity_threshold: config.complexity_threshold ?? 10,
    file_length_threshold: config.file_length_threshold ?? 300,
    exclude_domains: config.exclude_domains ?? [],
    severity_overrides: config.severity_overrides ?? {},
    ignore_dirs: config.ignore_dirs ?? ["node_modules", "dist", "build", ".git", "coverage"],
  };
}
