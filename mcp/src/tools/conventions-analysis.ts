import { readFile } from "node:fs/promises";
import { join, relative, extname } from "node:path";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import type { Finding } from "../types.js";
import { collectAllFiles } from "../utils/files.js";
import { createIdSequence } from "../utils/id.js";

const execFileAsync = promisify(execFile);

const MAX_SNIPPET_LENGTH = 120;
const MAX_TITLE_EXCERPT_LENGTH = 80;
const ESLINT_TIMEOUT_MS = 30_000;

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

/**
 * Parses an ESLint JSON report (if present) or runs ESLint with no-op rules
 * to collect linting findings. Also parses Checkstyle XML reports for Java projects.
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
 */
export async function detectDryViolations(projectDir: string): Promise<Finding[]> {
  const findings: Finding[] = [];
  const nextId = createIdSequence("CNV", 200);

  const files = await collectAllFiles(projectDir);
  const TEST_INFRA_PATH = /[/\\](?:__tests__|fixtures)[/\\]/;
  const srcFiles = files.filter(
    (f) => [".ts", ".js", ".java"].includes(extname(f)) && !TEST_INFRA_PATH.test(relative(projectDir, f)),
  );

  const BLOCK_SIZE = 6;
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
        if (block.length < 80) continue;
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
    if (uniqueFiles.length < 2) continue;

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
      const filePath = fileMatch ? relative(projectDir, fileMatch[1] ?? p) : p;
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
