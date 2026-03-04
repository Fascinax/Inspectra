import { readFile } from "node:fs/promises";
import { relative, extname } from "node:path";
import type { Finding } from "../types.js";
import type { ProfileConfig } from "../policies/loader.js";
import { collectAllFiles } from "../utils/files.js";
import { createIdSequence } from "../utils/id.js";

const MAX_SNIPPET_LENGTH = 120;
const MAX_TITLE_EXCERPT_LENGTH = 80;

const DEFAULT_FILE_LENGTH_WARNING = 400;
const DEFAULT_FILE_LENGTH_ERROR = 800;

/**
 * Flags files exceeding configured line-length thresholds.
 */
export async function checkFileLengths(projectDir: string, profile?: ProfileConfig): Promise<Finding[]> {
  const findings: Finding[] = [];
  const nextId = createIdSequence("CNV", 50);

  const warningThreshold = profile?.file_lengths?.warning ?? DEFAULT_FILE_LENGTH_WARNING;
  const errorThreshold = profile?.file_lengths?.error ?? DEFAULT_FILE_LENGTH_ERROR;

  const files = await collectAllFiles(projectDir);
  const TEST_INFRA_PATH = /[/\\](?:__tests__|fixtures)[/\\]/;

  for (const filePath of files) {
    if (![".ts", ".js", ".java"].includes(extname(filePath))) continue;
    if (TEST_INFRA_PATH.test(relative(projectDir, filePath))) continue;

    try {
      const content = await readFile(filePath, "utf-8");
      const lineCount = content.split("\n").length;

      if (lineCount > warningThreshold) {
        findings.push({
          id: nextId(),
          severity: lineCount > errorThreshold ? "high" : "medium",
          title: `File too long: ${relative(projectDir, filePath)} (${lineCount} lines)`,
          description: `Files longer than ${warningThreshold} lines are harder to maintain. Consider splitting responsibilities.`,
          domain: "conventions",
          rule: "file-too-long",
          confidence: 1.0,
          evidence: [{ file: relative(projectDir, filePath) }],
          recommendation: "Extract classes/functions into separate files following single responsibility principle.",
          effort: "medium",
          tags: ["complexity", "maintainability"],
        });
      }
    } catch {
      /* skip */
    }
  }

  return findings;
}

/**
 * Finds unresolved TODO, FIXME, HACK, and XXX comments in source files.
 */
export async function checkTodoFixmes(projectDir: string): Promise<Finding[]> {
  const findings: Finding[] = [];
  const nextId = createIdSequence("CNV", 100);

  const files = await collectAllFiles(projectDir);
  const TEST_INFRA_PATH = /[/\\](?:__tests__|fixtures)[/\\]/;

  for (const filePath of files) {
    if (![".ts", ".js", ".java"].includes(extname(filePath))) continue;
    if (TEST_INFRA_PATH.test(relative(projectDir, filePath))) continue;

    try {
      const content = await readFile(filePath, "utf-8");
      const lines = content.split("\n");

      for (let i = 0; i < lines.length; i++) {
        const line = lines[i];
        if (!line) continue;
        const todoMatch = line.match(/\/\/\s*(TODO|FIXME|HACK|XXX|WORKAROUND)\b[:\s]*(.*)/i);
        if (todoMatch) {
          const tag = (todoMatch[1] ?? "").toUpperCase();
          const message = todoMatch[2]?.trim() || "(no description)";
          const isUrgent = tag === "FIXME" || tag === "HACK" || tag === "XXX";

          findings.push({
            id: nextId(),
            severity: isUrgent ? "medium" : "low",
            title: `${tag} comment: ${message.substring(0, MAX_TITLE_EXCERPT_LENGTH)}`,
            domain: "conventions",
            rule: "unresolved-todo",
            confidence: 1.0,
            evidence: [{ file: relative(projectDir, filePath), line: i + 1, snippet: line.trim().substring(0, MAX_SNIPPET_LENGTH) }],
            recommendation: "Resolve the TODO/FIXME or create a tracked issue.",
            effort: "small",
            tags: ["tech-debt", tag.toLowerCase()],
          });
        }
      }
    } catch {
      /* skip */
    }
  }

  return findings;
}
