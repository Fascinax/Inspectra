import { resolve } from "node:path";
import { globby } from "globby";

const IGNORED_PATTERNS = [
  "**/node_modules/**",
  "**/dist/**",
  "**/.git/**",
  "**/coverage/**",
  "**/.cache/**",
];

const DEFAULT_SOURCE_EXTENSIONS = [".ts", ".js", ".java"];

/**
 * Recursively collects source files under `dir`, filtered by extension.
 *
 * @param dir - Root directory to walk.
 * @param extensions - File extensions to include (default: `.ts`, `.js`, `.java`).
 * @returns Absolute paths of all matching files.
 */
export async function collectSourceFiles(
  dir: string,
  extensions: string[] = DEFAULT_SOURCE_EXTENSIONS,
): Promise<string[]> {
  const patterns = extensions.map((ext) => `**/*${ext}`);
  const paths = await globby(patterns, {
    cwd: dir,
    ignore: IGNORED_PATTERNS,
    absolute: true,
    dot: false,
  });
  return paths.map((p) => resolve(p));
}

/**
 * Recursively collects every file under `dir` regardless of extension.
 *
 * @param dir - Root directory to walk.
 * @returns Absolute paths of all files found.
 */
export async function collectAllFiles(dir: string): Promise<string[]> {
  const paths = await globby("**/*", {
    cwd: dir,
    ignore: IGNORED_PATTERNS,
    absolute: true,
    dot: false,
    onlyFiles: true,
  });
  return paths.map((p) => resolve(p));
}
