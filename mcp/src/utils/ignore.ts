import { readFile } from "node:fs/promises";
import { join } from "node:path";
import type { Finding } from "../types.js";

export interface IgnoreRule {
  /** Rule identifier to suppress, or `"*"` to match any rule. */
  rule: string;
  /** File path substring to match, or `"*"` to match any file. */
  file: string;
}

/**
 * Loads per-project ignore rules from `.inspectraignore` in the project root.
 *
 * Format (one entry per line, `#` lines are comments):
 * ```
 * # suppress a rule everywhere
 * no-hardcoded-secret
 *
 * # suppress only for a specific path
 * dry-violation:src/generated/
 *
 * # suppress all findings in a path
 * *:vendor/
 * ```
 *
 * Returns an empty array when the file is absent.
 */
export async function loadIgnoreRules(projectDir: string): Promise<IgnoreRule[]> {
  try {
    const content = await readFile(join(projectDir, ".inspectraignore"), "utf-8");
    const rules: IgnoreRule[] = [];

    for (const raw of content.split("\n")) {
      const line = raw.trim();
      if (!line || line.startsWith("#")) continue;

      const colonIdx = line.indexOf(":");
      if (colonIdx === -1) {
        rules.push({ rule: line, file: "*" });
      } else {
        rules.push({
          rule: line.slice(0, colonIdx).trim(),
          file: line.slice(colonIdx + 1).trim() || "*",
        });
      }
    }

    return rules;
  } catch {
    // File absent or unreadable — no ignores applied
    return [];
  }
}

/**
 * Filters out findings that match at least one ignore rule.
 *
 * A finding is suppressed when:
 * 1. The rule matches exactly or the ignore rule is `"*"`.
 * 2. AND one of the evidence paths contains the ignore file pattern (substring),
 *    or the ignore file is `"*"`.
 */
export function applyIgnoreRules(findings: Finding[], rules: IgnoreRule[]): Finding[] {
  if (rules.length === 0) return findings;
  return findings.filter((f) => !isSuppressed(f, rules));
}

function isSuppressed(finding: Finding, rules: IgnoreRule[]): boolean {
  return rules.some((r) => {
    const ruleMatches = r.rule === "*" || r.rule === finding.rule;
    if (!ruleMatches) return false;
    if (r.file === "*") return true;
    return finding.evidence.some((e) => e.file.includes(r.file));
  });
}
