import { readFile } from "node:fs/promises";
import { join, relative, extname } from "node:path";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import type { Finding } from "../types.js";
import type { ProfileConfig } from "../policies/loader.js";
import { collectAllFiles } from "../utils/files.js";
import { createIdSequence } from "../utils/id.js";

const execFileAsync = promisify(execFile);

const MAX_SNIPPET_LENGTH = 120;
const MAX_TITLE_EXCERPT_LENGTH = 80;
const ESLINT_TIMEOUT_MS = 30_000;

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

const DEFAULT_FILE_LENGTH_WARNING = 400;
const DEFAULT_FILE_LENGTH_ERROR = 800;

/**
 * Checks that files follow expected naming conventions for Angular components,
 * Java layer classes, test files, and generic kebab-case modules.
 *
 * @param projectDir - Absolute path to the project root.
 * @param _profile - Optional policy profile (reserved for future profile-based rules).
 * @returns Array of `Finding` objects for each naming violation.
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
      });
    }
  }

  return findings;
}

/**
 * Flags files exceeding configured line-length thresholds.
 * Default threshold is 300 lines; profile-based overrides are supported.
 *
 * @param projectDir - Absolute path to the project root.
 * @param profile - Optional policy profile with custom `max_file_lines` threshold.
 * @returns Array of `Finding` objects for each overly long file.
 */
export async function checkFileLengths(projectDir: string, profile?: ProfileConfig): Promise<Finding[]> {
  const findings: Finding[] = [];
  const nextId = createIdSequence("CNV", 50);

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
 *
 * @param projectDir - Absolute path to the project root.
 * @returns Array of `Finding` objects, one per detected comment marker.
 */
export async function checkTodoFixmes(projectDir: string): Promise<Finding[]> {
  const findings: Finding[] = [];
  const nextId = createIdSequence("CNV", 100);

  const files = await collectAllFiles(projectDir);

  for (const filePath of files) {
    if (![".ts", ".js", ".java"].includes(extname(filePath))) continue;

    try {
      const content = await readFile(filePath, "utf-8");
      const lines = content.split("\n");

      for (let i = 0; i < lines.length; i++) {
        const line = lines[i];
        if (!line) continue;
        const todoMatch = line.match(/\/\/\s*(TODO|FIXME|HACK|XXX|WORKAROUND)\b[:\s]*(.*)/i);
        if (todoMatch) {
          const tag = todoMatch[1]!.toUpperCase();
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

type EslintFileResult = {
  filePath: string;
  messages: Array<{
    ruleId: string | null;
    severity: number;
    message: string;
    line: number;
    column?: number;
    source?: string;
  }>;
};

async function findEslintReport(projectDir: string): Promise<string | null> {
  const reportCandidates = [
    join(projectDir, "eslint-report.json"),
    join(projectDir, ".eslint-report.json"),
    join(projectDir, "reports", "eslint.json"),
  ];
  for (const p of reportCandidates) {
    try {
      return await readFile(p, "utf-8");
    } catch {
      /* file not found — try next */
    }
  }
  return null;
}

async function runEslintJson(projectDir: string): Promise<string | null> {
  try {
    try {
      const { stdout } = await execFileAsync(
        "npx",
        ["--no-install", "eslint", "--format", "json", "--no-eslintrc", "--rule", "{}", projectDir],
        { cwd: projectDir, timeout: ESLINT_TIMEOUT_MS },
      );
      return stdout;
    } catch (err: unknown) {
      const e = err as { stdout?: string };
      return e.stdout ?? null;
    }
  } catch {
    /* ESLint CLI not available — skip */
    return null;
  }
}

function parseEslintFindings(eslintJson: string, projectDir: string, nextId: () => string): Finding[] {
  const findings: Finding[] = [];
  try {
    const parsed: unknown = JSON.parse(eslintJson);
    if (!Array.isArray(parsed)) return [];
    const results = parsed as EslintFileResult[];
    for (const fileResult of results) {
      for (const msg of fileResult.messages ?? []) {
        if (!msg.ruleId) continue;
        findings.push({
          id: nextId(),
          severity: msg.severity === 2 ? "medium" : "low",
          title: `ESLint [${msg.ruleId}]: ${msg.message.substring(0, MAX_TITLE_EXCERPT_LENGTH)}`,
          description: `ESLint rule '${msg.ruleId}' triggered: ${msg.message}`,
          domain: "conventions",
          rule: `eslint/${msg.ruleId}`,
          confidence: 1.0,
          evidence: [
            {
              file: relative(projectDir, fileResult.filePath),
              line: msg.line,
              snippet: msg.source?.trim().substring(0, MAX_SNIPPET_LENGTH),
            },
          ],
          recommendation: `Fix the ESLint violation for rule '${msg.ruleId}'.`,
          effort: "trivial",
          tags: ["eslint", "lint"],
        });
      }
    }
  } catch {
    /* malformed JSON */
  }
  return findings;
}

async function parseCheckstyleFindings(projectDir: string, nextId: () => string): Promise<Finding[]> {
  const findings: Finding[] = [];
  const checkstyleCandidates = [
    join(projectDir, "target", "checkstyle-result.xml"),
    join(projectDir, "build", "reports", "checkstyle", "main.xml"),
    join(projectDir, "checkstyle-result.xml"),
  ];
  for (const p of checkstyleCandidates) {
    try {
      const xml = await readFile(p, "utf-8");
      const errorMatches = xml.matchAll(
        /<error\s+line="(\d+)"[^>]*severity="([^"]*)"[^>]*message="([^"]*)"[^>]*source="([^"]*)"/g,
      );
      const fileMatch = xml.match(/<file\s+name="([^"]*)"/);
      const filePath = fileMatch ? relative(projectDir, fileMatch[1]!) : p;
      for (const m of errorMatches) {
        const [, line, severity, message, source] = m;
        if (!line || !severity || !message || !source) continue;
        const ruleName = source.split(".").pop() ?? source;
        findings.push({
          id: nextId(),
          severity: severity === "error" ? "medium" : "low",
          title: `Checkstyle [${ruleName}]: ${message.substring(0, MAX_TITLE_EXCERPT_LENGTH)}`,
          description: message,
          domain: "conventions",
          rule: `checkstyle/${ruleName}`,
          confidence: 1.0,
          evidence: [{ file: relative(projectDir, filePath), line: parseInt(line, 10) }],
          recommendation: `Fix the Checkstyle violation for rule '${ruleName}'.`,
          effort: "trivial",
          tags: ["checkstyle", "lint"],
        });
      }
      break;
    } catch {
      /* file not found — try next */
    }
  }
  return findings;
}

/**
 * Parses an ESLint JSON report (if present) or runs ESLint with no-op rules
 * to collect linting findings. Also parses Checkstyle XML reports for Java projects.
 *
 * @param projectDir - Absolute path to the project root.
 * @returns Array of `Finding` objects from ESLint / Checkstyle output.
 */
export async function parseLintOutput(projectDir: string): Promise<Finding[]> {
  const nextId = createIdSequence("CNV", 150);
  const eslintJson = (await findEslintReport(projectDir)) ?? (await runEslintJson(projectDir));
  const eslintFindings = eslintJson ? parseEslintFindings(eslintJson, projectDir, nextId) : [];
  const checkstyleFindings = await parseCheckstyleFindings(projectDir, nextId);
  return [...eslintFindings, ...checkstyleFindings];
}

/**
 * Detects copy-paste / DRY violations by finding near-identical code blocks
 * (>= 6 consecutive lines) that appear in multiple files.
 *
 * @param projectDir - Absolute path to the project root.
 * @returns Array of `Finding` objects for each duplicated block detected.
 */
export async function detectDryViolations(projectDir: string): Promise<Finding[]> {
  const findings: Finding[] = [];
  const nextId = createIdSequence("CNV", 200);

  const files = await collectAllFiles(projectDir);
  const srcFiles = files.filter((f) => [".ts", ".js", ".java"].includes(extname(f)));

  const BLOCK_SIZE = 6; // minimum consecutive non-trivial lines to flag
  const blockMap = new Map<string, Array<{ file: string; startLine: number }>>();

  for (const filePath of srcFiles) {
    try {
      const content = await readFile(filePath, "utf-8");
      const lines = content.split("\n");
      const normalized = lines
        .map((l) => l.trim())
        .filter(
          (l) =>
            l.length > 2 &&
            !l.startsWith("//") &&
            !l.startsWith("*") &&
            !l.startsWith("import ") &&
            l !== "{" &&
            l !== "}" &&
            l !== "})" &&
            l !== "});" &&
            l !== "});",
        );

      for (let i = 0; i <= normalized.length - BLOCK_SIZE; i++) {
        const block = normalized.slice(i, i + BLOCK_SIZE).join("\n");
        if (block.length < 80) continue; // skip trivial small blocks
        const existing = blockMap.get(block) ?? [];
        existing.push({ file: relative(projectDir, filePath), startLine: i + 1 });
        blockMap.set(block, existing);
      }
    } catch {
      /* skip */
    }
  }

  const alreadyFlagged = new Set<string>();
  for (const [, locations] of blockMap) {
    if (locations.length < 2) continue;

    const uniqueFiles = [...new Set(locations.map((l) => l.file))];
    if (uniqueFiles.length < 2) continue; // same file duplications are less critical

    const key = uniqueFiles.sort().join("|");
    if (alreadyFlagged.has(key)) continue;
    alreadyFlagged.add(key);

    findings.push({
      id: nextId(),
      severity: "low",
      title: `Duplicated code block across ${uniqueFiles.length} files`,
      description: `A block of ${BLOCK_SIZE}+ lines appears in multiple files: ${uniqueFiles.slice(0, 3).join(", ")}. This violates the DRY (Don't Repeat Yourself) principle.`,
      domain: "conventions",
      rule: "dry-violation",
      confidence: 0.7,
      evidence: locations.slice(0, 3).map((l) => ({ file: l.file, line: l.startLine })),
      recommendation: "Extract the duplicated logic into a shared utility function or module.",
      effort: "medium",
      tags: ["dry", "duplication", "maintainability"],
    });
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
  const dirType = dirMatch[1]!.toLowerCase();
  const fileName = normalized.split("/").pop() ?? "";
  return fileName.includes(`.${dirType}.`) || fileName.includes(`.${dirType}s.`);
}
