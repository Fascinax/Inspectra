import { readFile } from "node:fs/promises";
import type { Finding } from "../types.js";
import { createIdSequence } from "../utils/id.js";

const MAX_SNIPPET_LENGTH = 120;

export const SECRET_PATTERNS = [
  {
    rule: "no-hardcoded-secret",
    pattern: /(password|secret|api_?key|token|credentials)\s*[:=]\s*["'][^"']{8,}["']/gi,
    severity: "high" as const,
  },
  {
    rule: "no-private-key",
    pattern: /-----BEGIN\s+(RSA|EC|DSA|OPENSSH)\s+PRIVATE\s+KEY-----/g,
    severity: "critical" as const,
  },
  {
    rule: "no-jwt-hardcoded",
    pattern: /eyJ[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}/g,
    severity: "high" as const,
  },
  {
    rule: "no-connection-string",
    pattern: /(jdbc|mongodb(\+srv)?|postgresql|mysql|redis):\/\/[^\s"']+/gi,
    severity: "high" as const,
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
};

async function scanSingleFile(
  filePath: string,
  patterns: SecretPattern[],
  nextId: () => string,
): Promise<Finding[]> {
  const findings: Finding[] = [];

  try {
    const content = await readFile(filePath, "utf-8");
    const lines = content.split("\n");

    for (const { rule, pattern, severity } of patterns) {
      for (let lineIndex = 0; lineIndex < lines.length; lineIndex++) {
        const line = lines[lineIndex];
        if (!line) continue;
        const regex = new RegExp(pattern.source, pattern.flags);
        if (regex.test(line)) {
          findings.push({
            id: nextId(),
            severity,
            title: `Potential secret detected: ${rule}`,
            description: `A pattern matching '${rule}' was found. This could expose sensitive credentials.`,
            domain: "security",
            rule,
            confidence: 0.85,
            evidence: [{ file: filePath, line: lineIndex + 1, snippet: line.trim().substring(0, MAX_SNIPPET_LENGTH) }],
            recommendation: "Move this value to an environment variable or a secrets manager.",
            effort: "small",
            tags: ["secret", "credentials"],
            source: "tool",
          });
        }
      }
    }
  } catch {
    /* skip unreadable files */
  }

  return findings;
}
