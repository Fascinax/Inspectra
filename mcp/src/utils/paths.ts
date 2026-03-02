import { resolve, isAbsolute } from "node:path";
import { stat } from "node:fs/promises";

/** Characters and sequences that signal path traversal or shell injection. */
const DANGEROUS_PATH_PATTERN = /\0|[;&|`$<>!]/;

/**
 * Validates that a path is safe to use as a project directory:
 * - Must be absolute
 * - Must not contain traversal sequences after normalization
 * - Must not contain shell metacharacters
 * - Must exist and be a directory
 *
 * @param rawPath - The raw path string received from MCP tool input.
 * @returns The resolved, normalized absolute path.
 * @throws `Error` with a descriptive message if the path is unsafe or invalid.
 */
export async function validateProjectDir(rawPath: string): Promise<string> {
  const normalized = resolve(rawPath);

  if (!isAbsolute(normalized)) {
    throw new Error(`Invalid path: must be absolute, got "${rawPath}"`);
  }

  if (DANGEROUS_PATH_PATTERN.test(rawPath)) {
    throw new Error(`Invalid path: contains forbidden characters in "${rawPath}"`);
  }

  let stats;
  try {
    stats = await stat(normalized);
  } catch {
    throw new Error(`Path does not exist or is not accessible: "${normalized}"`);
  }

  if (!stats.isDirectory()) {
    throw new Error(`Path must be a directory, got a file: "${normalized}"`);
  }

  return normalized;
}

/**
 * Validates a comma-separated list of absolute file paths.
 * Strips empty entries and validates each path individually.
 *
 * @param csv - Comma-separated absolute file paths.
 * @returns Array of resolved, validated absolute file paths.
 * @throws `Error` if any path is unsafe or does not exist.
 */
export async function validateFilePathsCsv(csv: string): Promise<string[]> {
  const paths = csv.split(",").map((p) => p.trim()).filter(Boolean);

  const validated: string[] = [];
  for (const rawPath of paths) {
    const normalized = resolve(rawPath);

    if (!isAbsolute(normalized)) {
      throw new Error(`Invalid file path: must be absolute, got "${rawPath}"`);
    }

    if (DANGEROUS_PATH_PATTERN.test(rawPath)) {
      throw new Error(`Invalid file path: contains forbidden characters in "${rawPath}"`);
    }

    let stats;
    try {
      stats = await stat(normalized);
    } catch {
      throw new Error(`File path does not exist: "${normalized}"`);
    }

    if (!stats.isFile()) {
      throw new Error(`Path must be a file, got a directory: "${normalized}"`);
    }

    validated.push(normalized);
  }

  return validated;
}
