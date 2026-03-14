import { relative, extname } from "node:path";
import type { Finding } from "../types.js";
import { collectSourceFiles } from "../utils/files.js";
import { createIdSequence } from "../utils/id.js";

const SOURCE_EXTENSIONS = [".ts", ".js", ".java"];
const TEST_PATTERNS = [/\.(test|spec)\.(ts|js|java)$/, /Test\.java$/];
const CONFIG_FILE_PATTERN = /(?:^|[/\\])(?:[\w-]+\.)?config\.(?:ts|js|mjs|cjs|java)$/;
const TEST_INFRA_PATH = /[/\\](?:__tests__|fixtures)[/\\]/;
const TRANSPORT_WIRING_PATH = /[/\\](?:controllers|routes|middleware)[/\\]/;

/**
 * Detects source files that have no corresponding test file based
 * on common naming conventions (`*.test.ts`, `*Test.java`, etc.).
 */
export async function detectMissingTests(projectDir: string): Promise<Finding[]> {
  const findings: Finding[] = [];
  const nextId = createIdSequence("TST", 100);

  const allFiles = await collectSourceFiles(projectDir);
  const sourceFiles = allFiles.filter(
    (f) => SOURCE_EXTENSIONS.includes(extname(f)) && !TEST_PATTERNS.some((p) => p.test(f)),
  );

  const testStems = new Set<string>();
  for (const f of allFiles) {
    if (TEST_PATTERNS.some((p) => p.test(f))) {
      const fileName = f.split(/[/\\]/).pop() ?? "";
      const stem = fileName.replace(/\.(test|spec)\.(ts|js|java)$/, ".$2").replace(/Test\.java$/, ".java");
      testStems.add(stem);
    }
  }

  for (const src of sourceFiles) {
    const relativePath = relative(projectDir, src);
    const baseName = src.split(/[/\\]/).pop() ?? "";
    if (baseName === "index.ts" || baseName === "index.js" || baseName.startsWith("types")) continue;
    if (CONFIG_FILE_PATTERN.test(src)) continue;
    if (TEST_INFRA_PATH.test(relativePath)) continue;
    if (TRANSPORT_WIRING_PATH.test(relativePath)) continue;

    const hasCoverage =
      testStems.has(baseName) || [...testStems].some((stem) => stem.endsWith(`-${baseName}`));

    if (!hasCoverage) {
      findings.push({
        id: nextId(),
        severity: "medium",
        title: `No test file for ${relativePath}`,
        domain: "tests",
        rule: "missing-test-file",
        confidence: 0.7,
        evidence: [{ file: relativePath }],
        recommendation: "Create a corresponding test file.",
        effort: "medium",
        tags: ["missing-test"],
        source: "tool",
      });
    }
  }

  return findings;
}
