import { join } from "node:path";
import { access } from "node:fs/promises";
import type { ProfileConfig } from "../types.js";
import { loadYaml } from "./utils.js";

const DEFAULT_PROFILE: ProfileConfig = {
  profile: "generic",
  coverage: {
    lines: { minimum: 60, target: 80 },
    branches: { minimum: 50, target: 70 },
    functions: { minimum: 60, target: 80 },
  },
  file_lengths: { warning: 400, error: 800 },
};

/**
 * Loads and parses the named stack profile from `profiles/<name>.yml`.
 * Falls back to `DEFAULT_PROFILE` (generic) when the file is absent.
 *
 * @param policiesDir - Absolute path to the policies directory.
 * @param profileName - Profile file name without extension (e.g. `"java-backend"`).
 * @returns Resolved `ProfileConfig`.
 */
export async function loadProfile(policiesDir: string, profileName: string): Promise<ProfileConfig> {
  const data = await loadYaml<Record<string, unknown>>(join(policiesDir, "profiles", `${profileName}.yml`));
  if (!data) return DEFAULT_PROFILE;

  const coverage = data.coverage as Record<string, Record<string, number>> | undefined;
  const fileLengths = data.file_lengths as Record<string, number> | undefined;

  return {
    profile: profileName,
    coverage: coverage
      ? {
          lines: coverage.lines
                ? { minimum: coverage.lines["minimum"] ?? 60, target: coverage.lines["target"] ?? 80 }
            : DEFAULT_PROFILE.coverage?.lines ?? { minimum: 60, target: 80 },
          branches: coverage.branches
            ? { minimum: coverage.branches["minimum"] ?? 50, target: coverage.branches["target"] ?? 70 }
            : DEFAULT_PROFILE.coverage?.branches ?? { minimum: 50, target: 70 },
          functions: coverage.functions
            ? { minimum: coverage.functions["minimum"] ?? 60, target: coverage.functions["target"] ?? 80 }
            : DEFAULT_PROFILE.coverage?.functions ?? { minimum: 60, target: 80 },
        }
      : DEFAULT_PROFILE.coverage,
    file_lengths: fileLengths
      ? { warning: fileLengths.warning ?? 400, error: fileLengths.error ?? 800 }
      : DEFAULT_PROFILE.file_lengths,
    naming: data.naming as Record<string, Record<string, string>> | undefined,
    architecture: data.architecture as ProfileConfig["architecture"] | undefined,
    security: data.security as ProfileConfig["security"] | undefined,
  };
}

// ─── Auto-detection ──────────────────────────────────────────────────────────

async function fileExists(filePath: string): Promise<boolean> {
  try {
    await access(filePath);
    return true;
  } catch {
    return false;
  }
}

/**
 * Heuristically selects the best matching profile for a project by inspecting
 * well-known signal files in the project root.
 *
 * Detection matrix:
 * - `pom.xml` or `build.gradle` → Java
 * - `angular.json`              → Angular
 * - `playwright.config.*`       → Playwright
 *
 * Mapping (most specific first):
 * - Java + Angular + Playwright → `java-angular-playwright`
 * - Java                        → `java-backend`
 * - Angular                     → `angular-frontend`
 * - otherwise                   → `generic`
 *
 * @param projectDir - Absolute path to the project root.
 * @returns The matched profile name.
 */
export async function detectProfile(projectDir: string): Promise<string> {
  const [hasPom, hasGradle, hasAngular, hasPlaywrightTs, hasPlaywrightJs, hasPlaywrightMjs] = await Promise.all([
    fileExists(join(projectDir, "pom.xml")),
    fileExists(join(projectDir, "build.gradle")),
    fileExists(join(projectDir, "angular.json")),
    fileExists(join(projectDir, "playwright.config.ts")),
    fileExists(join(projectDir, "playwright.config.js")),
    fileExists(join(projectDir, "playwright.config.mjs")),
  ]);

  const isJava = hasPom || hasGradle;
  const isAngular = hasAngular;
  const isPlaywright = hasPlaywrightTs || hasPlaywrightJs || hasPlaywrightMjs;

  if (isJava && isAngular && isPlaywright) return "java-angular-playwright";
  if (isJava) return "java-backend";
  if (isAngular) return "angular-frontend";
  return "generic";
}
