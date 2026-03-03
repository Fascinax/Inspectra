import { resolve, isAbsolute } from "node:path";
import { stat } from "node:fs/promises";
import { InvalidPathError } from "../errors.js";

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
 * @throws `InvalidPathError` with an actionable suggestion if the path is unsafe or invalid.
 */
export async function validateProjectDir(rawPath: string): Promise<string> {
  const normalized = resolve(rawPath);

  if (!isAbsolute(normalized)) {
    throw new InvalidPathError(
      `Invalid path: must be absolute, got "${rawPath}"`,
      "Provide a fully-qualified absolute path (e.g. /home/user/project or C:\\Users\\me\\project).",
    );
  }

  if (DANGEROUS_PATH_PATTERN.test(rawPath)) {
    throw new InvalidPathError(
      `Invalid path: contains forbidden characters in "${rawPath}"`,
      "Remove shell metacharacters (;, &, |, `, $, <, >, !) from the path.",
    );
  }

  let stats;
  try {
    stats = await stat(normalized);
  } catch {
    throw new InvalidPathError(
      `Path does not exist or is not accessible: "${normalized}"`,
      "Verify the directory exists and the server process has read permissions. Avoid symlinks to non-existent targets.",
    );
  }

  if (!stats.isDirectory()) {
    throw new InvalidPathError(
      `Path must be a directory, got a file: "${normalized}"`,
      "Provide the project root directory, not a file path. The tool scans the entire directory tree.",
    );
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
  const paths = csv
    .split(",")
    .map((p) => p.trim())
    .filter(Boolean);

  const validated: string[] = [];
  for (const rawPath of paths) {
    const normalized = resolve(rawPath);

    if (!isAbsolute(normalized)) {
      throw new InvalidPathError(
        `Invalid file path: must be absolute, got "${rawPath}"`,
        "Provide fully-qualified absolute file paths separated by commas.",
      );
    }

    if (DANGEROUS_PATH_PATTERN.test(rawPath)) {
      throw new InvalidPathError(
        `Invalid file path: contains forbidden characters in "${rawPath}"`,
        "Remove shell metacharacters (;, &, |, `, $, <, >, !) from each file path.",
      );
    }

    let stats;
    try {
      stats = await stat(normalized);
    } catch {
      throw new InvalidPathError(
        `File path does not exist: "${normalized}"`,
        "Verify the file exists and the server process has read permissions.",
      );
    }

    if (!stats.isFile()) {
      throw new InvalidPathError(
        `Path must be a file, got a directory: "${normalized}"`,
        "Provide a file path, not a directory. Use projectDir-based tools to scan directories.",
      );
    }

    validated.push(normalized);
  }

  return validated;
}
