import { readFile, readdir } from "node:fs/promises";
import { join, relative, extname } from "node:path";
import type { Finding } from "../types.js";
import type { ProfileConfig } from "../policies/loader.js";

const NAMING_CONVENTIONS: Array<{ pattern: RegExp; expected: string; rule: string }> = [
  { pattern: /\.(component|service|module|pipe|directive|guard|interceptor|resolver)\.ts$/, expected: "Angular naming", rule: "angular-naming-convention" },
  { pattern: /\.(controller|resource|repository|entity|dto)\.java$/, expected: "Java layer naming", rule: "java-naming-convention" },
  { pattern: /\.(test|spec)\.(ts|js|java)$/, expected: "Test file naming", rule: "test-naming-convention" },
];

const DEFAULT_FILE_LENGTH_WARNING = 400;
const DEFAULT_FILE_LENGTH_ERROR = 800;

export async function checkNamingConventions(projectDir: string): Promise<Finding[]> {
  const findings: Finding[] = [];
  let counter = 1;

  const files = await collectAllFiles(projectDir);

  const sourceFiles = files.filter((f) => [".ts", ".js", ".java"].includes(extname(f)));

  for (const filePath of sourceFiles) {
    const fileName = filePath.split(/[/\\]/).pop() ?? "";

    const matchedConvention = NAMING_CONVENTIONS.find((c) => c.pattern.test(fileName));
    if (matchedConvention) continue;

    if (isInConventionalDirectory(filePath) && !followsDirectoryConvention(filePath)) {
      findings.push({
        id: `CNV-${String(counter++).padStart(3, "0")}`,
        severity: "low",
        title: `File may not follow naming conventions: ${fileName}`,
        domain: "conventions",
        rule: "file-naming-convention",
        confidence: 0.6,
        evidence: [{ file: relative(projectDir, filePath) }],
        recommendation: "Rename the file to match the project's naming conventions (e.g., *.service.ts, *.controller.java).",
        effort: "trivial",
        tags: ["naming"],
      });
    }
  }

  return findings;
}

export async function checkFileLengths(projectDir: string, profile?: ProfileConfig): Promise<Finding[]> {
  const findings: Finding[] = [];
  let counter = 50;

  const warningThreshold = profile?.file_lengths?.warning ?? DEFAULT_FILE_LENGTH_WARNING;
  const errorThreshold = profile?.file_lengths?.error ?? DEFAULT_FILE_LENGTH_ERROR;

  const files = await collectAllFiles(projectDir);

  for (const filePath of files) {
    if (![".ts", ".js", ".java"].includes(extname(filePath))) continue;

    try {
      const content = await readFile(filePath, "utf-8");
      const lineCount = content.split("\n").length;

      if (lineCount > warningThreshold) {
        findings.push({
          id: `CNV-${String(counter++).padStart(3, "0")}`,
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

export async function checkTodoFixmes(projectDir: string): Promise<Finding[]> {
  const findings: Finding[] = [];
  let counter = 100;

  const files = await collectAllFiles(projectDir);

  for (const filePath of files) {
    if (![".ts", ".js", ".java"].includes(extname(filePath))) continue;

    try {
      const content = await readFile(filePath, "utf-8");
      const lines = content.split("\n");

      for (let i = 0; i < lines.length; i++) {
        const line = lines[i];
        const todoMatch = line.match(/\/\/\s*(TODO|FIXME|HACK|XXX|WORKAROUND)\b[:\s]*(.*)/i);
        if (todoMatch) {
          const tag = todoMatch[1].toUpperCase();
          const message = todoMatch[2].trim() || "(no description)";
          const isUrgent = tag === "FIXME" || tag === "HACK" || tag === "XXX";

          findings.push({
            id: `CNV-${String(counter++).padStart(3, "0")}`,
            severity: isUrgent ? "medium" : "low",
            title: `${tag} comment: ${message.substring(0, 80)}`,
            domain: "conventions",
            rule: "unresolved-todo",
            confidence: 1.0,
            evidence: [{ file: relative(projectDir, filePath), line: i + 1, snippet: line.trim().substring(0, 120) }],
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

function isInConventionalDirectory(filePath: string): boolean {
  const normalized = filePath.replaceAll("\\", "/");
  return /\/(controllers?|services?|repositories?|components?|pipes?|guards?|interceptors?|models?|entities?|dtos?)\//i.test(normalized);
}

function followsDirectoryConvention(filePath: string): boolean {
  const normalized = filePath.replaceAll("\\", "/");
  const dirMatch = normalized.match(/\/(controller|service|repository|component|pipe|guard|interceptor|model|entity|dto)s?\//i);
  if (!dirMatch) return true;
  const dirType = dirMatch[1].toLowerCase();
  const fileName = normalized.split("/").pop() ?? "";
  return fileName.includes(`.${dirType}.`) || fileName.includes(`.${dirType}s.`);
}

async function collectAllFiles(dir: string, collected: string[] = []): Promise<string[]> {
  try {
    const entries = await readdir(dir, { withFileTypes: true });
    for (const entry of entries) {
      const fullPath = join(dir, entry.name);
      if (entry.name === "node_modules" || entry.name === "dist" || entry.name.startsWith(".")) continue;
      if (entry.isDirectory()) {
        await collectAllFiles(fullPath, collected);
      } else {
        collected.push(fullPath);
      }
    }
  } catch {
    /* skip */
  }
  return collected;
}
