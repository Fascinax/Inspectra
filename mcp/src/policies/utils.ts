import { readFile } from "node:fs/promises";
import { parse as parseYaml } from "yaml";

/**
 * Reads a YAML file and parses it. Returns `null` on any error.
 * @internal
 */
export async function loadYaml<T>(filePath: string): Promise<T | null> {
  try {
    const raw = await readFile(filePath, "utf-8");
    return parseYaml(raw) as T;
  } catch {
    return null;
  }
}
