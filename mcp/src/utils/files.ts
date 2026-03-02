import { readdir } from "node:fs/promises";
import { join, extname } from "node:path";

const DEFAULT_IGNORED = ["node_modules", "dist", ".git", "coverage", ".cache"];
const DEFAULT_SOURCE_EXTENSIONS = [".ts", ".js", ".java"];

async function walkSourceFiles(dir: string, extensions: string[], acc: string[]): Promise<void> {
  try {
    const entries = await readdir(dir, { withFileTypes: true });
    for (const entry of entries) {
      if (DEFAULT_IGNORED.includes(entry.name) || entry.name.startsWith(".")) continue;
      const fullPath = join(dir, entry.name);
      if (entry.isDirectory()) {
        await walkSourceFiles(fullPath, extensions, acc);
      } else if (extensions.includes(extname(entry.name))) {
        acc.push(fullPath);
      }
    }
  } catch {
    /* unreadable — skip */
  }
}

async function walkAllFiles(dir: string, acc: string[]): Promise<void> {
  try {
    const entries = await readdir(dir, { withFileTypes: true });
    for (const entry of entries) {
      if (DEFAULT_IGNORED.includes(entry.name) || entry.name.startsWith(".")) continue;
      const fullPath = join(dir, entry.name);
      if (entry.isDirectory()) {
        await walkAllFiles(fullPath, acc);
      } else {
        acc.push(fullPath);
      }
    }
  } catch {
    /* unreadable — skip */
  }
}

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
  const acc: string[] = [];
  await walkSourceFiles(dir, extensions, acc);
  return acc;
}

/**
 * Recursively collects every file under `dir` regardless of extension.
 *
 * @param dir - Root directory to walk.
 * @returns Absolute paths of all files found.
 */
export async function collectAllFiles(dir: string): Promise<string[]> {
  const acc: string[] = [];
  await walkAllFiles(dir, acc);
  return acc;
}
