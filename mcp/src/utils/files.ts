import { readdir } from "node:fs/promises";
import { join, extname } from "node:path";

const DEFAULT_IGNORED = ["node_modules", "dist", ".git", "coverage", ".cache"];
const DEFAULT_SOURCE_EXTENSIONS = [".ts", ".js", ".java"];

/**
 * Recursively collects source files under `dir`, filtered by extension.
 *
 * @param dir - Root directory to walk.
 * @param extensions - File extensions to include (default: `.ts`, `.js`, `.java`).
 * @param collected - Internal accumulator — do not pass this externally.
 * @returns Absolute paths of all matching files.
 */
export async function collectSourceFiles(
  dir: string,
  extensions: string[] = DEFAULT_SOURCE_EXTENSIONS,
  collected: string[] = [],
): Promise<string[]> {
  try {
    const entries = await readdir(dir, { withFileTypes: true });
    for (const entry of entries) {
      if (DEFAULT_IGNORED.includes(entry.name) || entry.name.startsWith(".")) continue;
      const fullPath = join(dir, entry.name);
      if (entry.isDirectory()) {
        await collectSourceFiles(fullPath, extensions, collected);
      } else if (extensions.includes(extname(entry.name))) {
        collected.push(fullPath);
      }
    }
  } catch {
    /* directory not readable — skip silently */
  }
  return collected;
}

/**
 * Recursively collects every file under `dir` regardless of extension.
 *
 * @param dir - Root directory to walk.
 * @param collected - Internal accumulator — do not pass this externally.
 * @returns Absolute paths of all files found.
 */
export async function collectAllFiles(dir: string, collected: string[] = []): Promise<string[]> {
  try {
    const entries = await readdir(dir, { withFileTypes: true });
    for (const entry of entries) {
      if (DEFAULT_IGNORED.includes(entry.name) || entry.name.startsWith(".")) continue;
      const fullPath = join(dir, entry.name);
      if (entry.isDirectory()) {
        await collectAllFiles(fullPath, collected);
      } else {
        collected.push(fullPath);
      }
    }
  } catch {
    /* directory not readable — skip silently */
  }
  return collected;
}
