import { readFile } from "node:fs/promises";
import type { Finding } from "../types.js";
import { createIdSequence } from "../utils/id.js";
import { logger } from "../logger.js";

const MAX_SNIPPET_LENGTH = 120;

/** Lines that are purely comments — skip them to avoid flagging documented examples. */
const COMMENT_LINE_PATTERN = /^\s*(?:\/\/|\/\*|\*|#)/;

/** Placeholder values that signal a non-secret (template, example, test fixture). */
const PLACEHOLDER_PATTERN =
  /\b(placeholder|changeme|change[_-]?me|your[_-]?\w*[_-]?here|todo[_-]?replace|replace[_-]?me|fill[_-]?in|example|xxx+|test[_-]?password|dummy|fake|sample|override|insert[_-]?here)\b/i;

/** Files in fixture/example/mock directories carry lower confidence. */
const FIXTURE_OR_EXAMPLE_PATH =
  /[/\\](?:__tests__|test[/\\]fixtures?|fixtures?|examples?|mocks?|stubs?|__mocks__)[/\\]|\.(?:example|sample|fixture)\./;

export const SECRET_PATTERNS = [
  {
    rule: "no-hardcoded-secret",
    pattern: /(password|secret|api_?key|token|credentials)\s*[:=]\s*["'][^"']{8,}["']/gi,
    severity: "high" as const,
    confidence: 0.70,
  },
  {
    rule: "no-private-key",
    pattern: /-----BEGIN\s+(RSA|EC|DSA|OPENSSH)\s+PRIVATE\s+KEY-----/g,
    severity: "critical" as const,
    confidence: 0.95,
  },
  {
    rule: "no-jwt-hardcoded",
    pattern: /eyJ[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}/g,
    severity: "high" as const,
    confidence: 0.85,
  },
  {
    rule: "no-connection-string",
    pattern: /(jdbc|mongodb(\+srv)?|postgresql|mysql|redis):\/\/[^\s"']+/gi,
    severity: "high" as const,
    confidence: 0.90,
  },
];

/**
 * Scans files for hardcoded secrets, API keys, tokens, and private keys
 * using built-in and optional custom patterns.
 */
export async function scanSecrets(
  filePaths: ReadonlyArray<string>,
  additionalPatterns?: Array<{ rule: string; pattern: string; severity: string }>,
): Promise<Finding[]> {
  const extraPatterns = (additionalPatterns ?? []).map((p) => ({
    rule: p.rule,
    pattern: new RegExp(p.pattern, "gi"),
    severity: p.severity as Finding["severity"],
    confidence: 0.80,
  }));
  const allPatterns = [...SECRET_PATTERNS, ...extraPatterns];

  const findings: Finding[] = [];
  const nextId = createIdSequence("SEC");

  for (const filePath of filePaths) {
    // Check if this is a committed .env file — test the filename, not the content
    const fileName = filePath.split(/[\/\\]/).pop() ?? "";
    if (/^\.env(?:\.(local|development|staging|production|test))?$/.test(fileName)) {
      findings.push({
        id: nextId(),
        severity: "medium",
        title: `Committed .env file detected: ${fileName}`,
        description: `The file '${fileName}' appears to be a committed environment file. .env files often contain secrets and should not be tracked by version control.`,
        domain: "security",
        rule: "no-env-file-committed",
        confidence: 0.95,
        evidence: [{ file: filePath }],
        recommendation: "Add .env to .gitignore and use .env.example as a template with placeholder values.",
        effort: "small",
        tags: ["secret", "dotenv"],
        source: "tool",
      });
    }

    const fileFindings = await scanSingleFile(filePath, allPatterns, nextId);
    findings.push(...fileFindings);
  }

  return findings;
}

type SecretPattern = {
  rule: string;
  pattern: RegExp;
  severity: Finding["severity"];
  confidence: number;
};

async function scanSingleFile(
  filePath: string,
  patterns: SecretPattern[],
  nextId: () => string,
): Promise<Finding[]> {
  const findings: Finding[] = [];
  const isFixturePath = FIXTURE_OR_EXAMPLE_PATH.test(filePath);

  try {
    const content = await readFile(filePath, "utf-8");
    const lines = content.split("\n");

    for (const { rule, pattern, severity, confidence: baseConfidence } of patterns) {
      for (let lineIndex = 0; lineIndex < lines.length; lineIndex++) {
        const line = lines[lineIndex];
        if (!line) continue;

        // Skip pure comment lines — annotated examples are not active secrets
        if (COMMENT_LINE_PATTERN.test(line)) continue;

        const regex = new RegExp(pattern.source, pattern.flags);
        const match = regex.exec(line);
        if (!match) continue;

        // Skip obvious placeholder values
        if (PLACEHOLDER_PATTERN.test(match[0])) continue;

        // Reduce confidence for fixture/example paths
        const confidence = isFixturePath ? Math.max(baseConfidence - 0.20, 0.30) : baseConfidence;

        findings.push({
          id: nextId(),
          severity,
          title: `Potential secret detected: ${rule}`,
          description: `A pattern matching '${rule}' was found. This could expose sensitive credentials.`,
          domain: "security",
          rule,
          confidence,
          evidence: [{ file: filePath, line: lineIndex + 1, snippet: line.trim().substring(0, MAX_SNIPPET_LENGTH) }],
          recommendation: "Move this value to an environment variable or a secrets manager.",
          effort: "small",
          tags: ["secret", "credentials"],
          source: "tool",
        });
      }
    }
  } catch (err) {
    logger.warn("scanSecrets: could not read file", { file: filePath, error: String(err) });
  }

  return findings;
}
