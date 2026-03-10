import { resolve } from "node:path";
import { globby } from "globby";

const DEFAULT_IGNORED_PATTERNS = [
  "**/node_modules/**",
  "**/dist/**",
  "**/.git/**",
  "**/coverage/**",
  "**/.cache/**",
];

const DEFAULT_SOURCE_EXTENSIONS = [".ts", ".js", ".java"];

/**
 * Builds ignore patterns by merging the built-in defaults with optional
 * extra directories supplied by the caller (e.g. from `.inspectrarc.yml`).
 */
function buildIgnorePatterns(extraIgnoreDirs?: string[]): string[] {
  if (!extraIgnoreDirs?.length) return DEFAULT_IGNORED_PATTERNS;
  const extra = extraIgnoreDirs.map((d) => `**/${d}/**`);
  return [...DEFAULT_IGNORED_PATTERNS, ...extra];
}

/**
 * Recursively collects source files under `dir`, filtered by extension.
 *
 * @param dir - Root directory to walk.
 * @param extensions - File extensions to include (default: `.ts`, `.js`, `.java`).
 * @param ignoreDirs - Extra directory names to ignore (merged with built-in defaults).
 * @returns Absolute paths of all matching files.
 */
export async function collectSourceFiles(
  dir: string,
  extensions: string[] = DEFAULT_SOURCE_EXTENSIONS,
  ignoreDirs?: string[],
): Promise<string[]> {
  const patterns = extensions.map((ext) => `**/*${ext}`);
  const paths = await globby(patterns, {
    cwd: dir,
    ignore: buildIgnorePatterns(ignoreDirs),
    absolute: true,
    dot: false,
  });
  return paths.map((p) => resolve(p));
}

/**
 * Recursively collects every file under `dir` regardless of extension.
 *
 * @param dir - Root directory to walk.
 * @param ignoreDirs - Extra directory names to ignore (merged with built-in defaults).
 * @param options - Additional collection options.
 * @param options.dot - Include dotfiles (default: false).
 * @returns Absolute paths of all files found.
 */
export async function collectAllFiles(
  dir: string,
  ignoreDirs?: string[],
  options?: { dot?: boolean },
): Promise<string[]> {
  const paths = await globby("**/*", {
    cwd: dir,
    ignore: buildIgnorePatterns(ignoreDirs),
    absolute: true,
    dot: options?.dot ?? false,
    onlyFiles: true,
  });
  return paths.map((p) => resolve(p));
}
