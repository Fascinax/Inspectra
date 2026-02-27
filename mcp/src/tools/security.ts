import { execFile } from "node:child_process";
import { readFile } from "node:fs/promises";
import { promisify } from "node:util";
import type { Finding } from "../types.js";

const execFileAsync = promisify(execFile);

const SECRET_PATTERNS = [
  { rule: "no-hardcoded-secret", pattern: /(password|secret|api_?key|token|credentials)\s*[:=]\s*["'][^"']{8,}["']/gi, severity: "high" as const },
  { rule: "no-private-key", pattern: /-----BEGIN\s+(RSA|EC|DSA|OPENSSH)\s+PRIVATE\s+KEY-----/g, severity: "critical" as const },
  { rule: "no-env-file-committed", pattern: /^\.env$/g, severity: "medium" as const },
  { rule: "no-jwt-hardcoded", pattern: /eyJ[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}/g, severity: "high" as const },
  { rule: "no-connection-string", pattern: /(jdbc|mongodb(\+srv)?|postgresql|mysql|redis):\/\/[^\s"']+/gi, severity: "high" as const },
];

export async function scanSecrets(filePaths: string[]): Promise<Finding[]> {
  const findings: Finding[] = [];
  let counter = 1;

  for (const filePath of filePaths) {
    try {
      const content = await readFile(filePath, "utf-8");
      const lines = content.split("\n");

      for (const { rule, pattern, severity } of SECRET_PATTERNS) {
        for (let lineIndex = 0; lineIndex < lines.length; lineIndex++) {
          const line = lines[lineIndex];
          const regex = new RegExp(pattern.source, pattern.flags);
          if (regex.test(line)) {
            findings.push({
              id: `SEC-${String(counter++).padStart(3, "0")}`,
              severity,
              title: `Potential secret detected: ${rule}`,
              description: `A pattern matching '${rule}' was found. This could expose sensitive credentials.`,
              domain: "security",
              rule,
              confidence: 0.85,
              evidence: [{ file: filePath, line: lineIndex + 1, snippet: line.trim().substring(0, 120) }],
              recommendation: "Move this value to an environment variable or a secrets manager.",
              effort: "small",
              tags: ["secret", "credentials"],
            });
          }
        }
      }
    } catch {
      /* skip unreadable files */
    }
  }

  return findings;
}

export async function checkDependencyVulnerabilities(projectDir: string): Promise<Finding[]> {
  const findings: Finding[] = [];

  try {
    const { stdout } = await execFileAsync("npm", ["audit", "--json"], { cwd: projectDir, timeout: 30_000 });
    const audit = JSON.parse(stdout);

    let counter = 1;
    const vulnerabilities = audit.vulnerabilities ?? {};

    for (const [pkgName, vuln] of Object.entries<Record<string, unknown>>(vulnerabilities)) {
      const severity = mapNpmSeverity(vuln.severity as string);
      findings.push({
        id: `SEC-${String(100 + counter++).padStart(3, "0")}`,
        severity,
        title: `Vulnerable dependency: ${pkgName}`,
        description: `${vuln.via ?? "Known vulnerability"} in ${pkgName}`,
        domain: "security",
        rule: "no-vulnerable-dependency",
        confidence: 0.95,
        evidence: [{ file: "package-lock.json" }],
        recommendation: `Run \`npm audit fix\` or upgrade ${pkgName} to a patched version.`,
        effort: "small",
        tags: ["dependency", "vulnerability"],
      });
    }
  } catch {
    /* npm audit not available or project has no package-lock.json */
  }

  return findings;
}

function mapNpmSeverity(npmSev: string): Finding["severity"] {
  const mapping: Record<string, Finding["severity"]> = {
    critical: "critical",
    high: "high",
    moderate: "medium",
    low: "low",
    info: "info",
  };
  return mapping[npmSev] ?? "medium";
}
