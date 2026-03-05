import { relative, extname } from "node:path";
import type { Finding } from "../types.js";
import { collectAllFiles } from "../utils/files.js";
import { createIdSequence } from "../utils/id.js";

const NAMING_CONVENTIONS: Array<{ pattern: RegExp; expected: string; rule: string }> = [
  {
    pattern: /\.(component|service|module|pipe|directive|guard|interceptor|resolver)\.ts$/,
    expected: "Angular naming",
    rule: "angular-naming-convention",
  },
  {
    pattern: /\.(controller|resource|repository|entity|dto)\.java$/,
    expected: "Java layer naming",
    rule: "java-naming-convention",
  },
  { pattern: /\.(test|spec)\.(ts|js|java)$/, expected: "Test file naming", rule: "test-naming-convention" },
];

/**
 * Checks that files follow expected naming conventions for Angular components,
 * Java layer classes, test files, and generic kebab-case modules.
 */
export async function checkNamingConventions(projectDir: string): Promise<Finding[]> {
  const findings: Finding[] = [];
  const nextId = createIdSequence("CNV");

  const files = await collectAllFiles(projectDir);
  const sourceFiles = files.filter((f) => [".ts", ".js", ".java"].includes(extname(f)));

  for (const filePath of sourceFiles) {
    const fileName = filePath.split(/[/\\]/).pop() ?? "";

    const matchedConvention = NAMING_CONVENTIONS.find((c) => c.pattern.test(fileName));
    if (matchedConvention) continue;

    if (isInConventionalDirectory(filePath) && !followsDirectoryConvention(filePath)) {
      findings.push({
        id: nextId(),
        severity: "low",
        title: `File may not follow naming conventions: ${fileName}`,
        domain: "conventions",
        rule: "file-naming-convention",
        confidence: 0.6,
        evidence: [{ file: relative(projectDir, filePath) }],
        recommendation:
          "Rename the file to match the project's naming conventions (e.g., *.service.ts, *.controller.java).",
        effort: "trivial",
        tags: ["naming"],
        source: "tool",
      });
    }
  }

  return findings;
}

function isInConventionalDirectory(filePath: string): boolean {
  const normalized = filePath.replaceAll("\\", "/");
  return /\/(controllers?|services?|repositories?|components?|pipes?|guards?|interceptors?|models?|entities?|dtos?)\//i.test(
    normalized,
  );
}

function followsDirectoryConvention(filePath: string): boolean {
  const normalized = filePath.replaceAll("\\", "/");
  const dirMatch = normalized.match(
    /\/(controller|service|repository|component|pipe|guard|interceptor|model|entity|dto)s?\//i,
  );
  if (!dirMatch) return true;
  const dirType = (dirMatch[1] ?? "").toLowerCase();
  const fileName = normalized.split("/").pop() ?? "";
  return fileName.includes(`.${dirType}.`) || fileName.includes(`.${dirType}s.`);
}
