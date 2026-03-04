import { readFile } from "node:fs/promises";
import { join, relative } from "node:path";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import type { Finding } from "../types.js";
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
