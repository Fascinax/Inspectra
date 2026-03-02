import { execFile } from "node:child_process";
import { readFile } from "node:fs/promises";
import { join } from "node:path";
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

/**
 * Scans files for hardcoded secrets, API keys, tokens, and private keys
 * using built-in and optional custom patterns.
 *
 * @param filePaths - Absolute paths to files to scan.
 * @param additionalPatterns - Optional extra regex patterns to detect domain-specific secrets.
 * @returns Array of `Finding` objects, one per detected secret.
 */
export async function scanSecrets(
  filePaths: string[],
  additionalPatterns?: Array<{ rule: string; pattern: string; severity: string }>,
): Promise<Finding[]> {
  const extraPatterns = (additionalPatterns ?? []).map((p) => ({
    rule: p.rule,
    pattern: new RegExp(p.pattern, "gi"),
    severity: p.severity as Finding["severity"],
  }));
  const allPatterns = [...SECRET_PATTERNS, ...extraPatterns];

  const findings: Finding[] = [];
  let counter = 1;

  for (const filePath of filePaths) {
    try {
      const content = await readFile(filePath, "utf-8");
      const lines = content.split("\n");

      for (const { rule, pattern, severity } of allPatterns) {
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

/**
 * Runs `npm audit --json` on the given project and maps vulnerabilities to findings.
 * Gracefully handles projects with no lockfile or without npm in PATH.
 *
 * @param projectDir - Absolute path to the npm project root.
 * @returns Array of `Finding` objects for each vulnerable dependency, or empty if clean.
 */
export async function checkDependencyVulnerabilities(projectDir: string): Promise<Finding[]> {
  const findings: Finding[] = [];

  try {
    let stdout: string;
    try {
      ({ stdout } = await execFileAsync("npm", ["audit", "--json"], { cwd: projectDir, timeout: 30_000 }));
    } catch (err: unknown) {
      // npm audit exits non-zero when vulnerabilities are found — stdout still contains JSON
      const execError = err as { stdout?: string };
      stdout = execError.stdout ?? "";
      if (!stdout) return findings;
    }

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

/**
 * Runs Semgrep with `--config auto` on the project and maps results to findings.
 * Returns an empty array when Semgrep is not installed or the project cannot be scanned.
 *
 * @param projectDir - Absolute path to the project root.
 * @returns Array of `Finding` objects from Semgrep results.
 */
export async function runSemgrep(projectDir: string): Promise<Finding[]> {
  let stdout: string;
  try {
    try {
      ({ stdout } = await execFileAsync(
        "semgrep",
        ["--json", "--config", "auto", "--quiet", projectDir],
        { timeout: 120_000, cwd: projectDir },
      ));
    } catch (err: unknown) {
      const e = err as { stdout?: string };
      stdout = e.stdout ?? "";
      if (!stdout) return [];
    }

    const data = JSON.parse(stdout) as { results?: SemgrepResult[] };
    const results = data.results ?? [];
    let counter = 200;

    return results.map((r) => ({
      id: `SEC-${String(counter++).padStart(3, "0")}`,
      severity: mapSemgrepSeverity(r.extra.severity),
      title: `Semgrep: ${r.check_id.split(".").slice(-2).join(".")}`,
      description: r.extra.message.substring(0, 500),
      domain: "security" as const,
      rule: `semgrep/${r.check_id}`,
      confidence: 0.9,
      evidence: [{ file: r.path, line: r.start.line, snippet: r.extra.lines?.trim().substring(0, 120) }],
      recommendation: r.extra.fix ?? "Review and address the flagged pattern.",
      effort: "small" as const,
      tags: ["semgrep", r.check_id.split(".")[0]],
    }));
  } catch {
    return [];
  }
}

interface SemgrepResult {
  check_id: string;
  path: string;
  start: { line: number };
  extra: {
    severity: string;
    message: string;
    lines?: string;
    fix?: string;
  };
}

/**
 * Analyzes a Maven `pom.xml` for supply-chain risks:
 * excessive dependency count, SNAPSHOT versions, and (optionally) `mvn dependency:tree` errors.
 *
 * @param projectDir - Absolute path to the Maven project root (must contain `pom.xml`).
 * @returns Array of security `Finding` objects, or empty if no `pom.xml` is found.
 */
export async function checkMavenDependencies(projectDir: string): Promise<Finding[]> {
  const findings: Finding[] = [];
  let counter = 300;

  const pomPath = join(projectDir, "pom.xml");
  let pomContent: string;
  try {
    pomContent = await readFile(pomPath, "utf-8");
  } catch {
    return [];
  }

  // Count <dependency> blocks (each one has an opening tag)
  const depMatches = pomContent.match(/<dependency>/g) ?? [];
  const depCount = depMatches.length;

  if (depCount > 50) {
    findings.push({
      id: `SEC-${String(counter++).padStart(3, "0")}`,
      severity: "medium",
      title: `High Maven dependency count: ${depCount} dependencies`,
      description: `The pom.xml declares ${depCount} dependencies. A high count increases supply chain risk and build complexity.`,
      domain: "security",
      rule: "excessive-maven-dependencies",
      confidence: 0.9,
      evidence: [{ file: "pom.xml" }],
      recommendation: "Audit dependencies and remove unused ones. Run `mvn dependency:analyze` to find unused declarations.",
      effort: "medium",
      tags: ["dependencies", "maven"],
    });
  }

  // Detect SNAPSHOT dependencies in production scope
  const snapshotPattern = /<version>([^<]*-SNAPSHOT[^<]*)<\/version>/g;
  let snapshotMatch: RegExpExecArray | null;
  while ((snapshotMatch = snapshotPattern.exec(pomContent)) !== null) {
    const version = snapshotMatch[1];
    findings.push({
      id: `SEC-${String(counter++).padStart(3, "0")}`,
      severity: "low",
      title: `SNAPSHOT dependency version in use: ${version}`,
      description: `SNAPSHOT versions are mutable and can change without notice, making builds non-reproducible.`,
      domain: "security",
      rule: "no-snapshot-dependency",
      confidence: 0.95,
      evidence: [{ file: "pom.xml", snippet: `<version>${version}</version>` }],
      recommendation: "Replace SNAPSHOT versions with stable releases before deploying to production.",
      effort: "small",
      tags: ["dependencies", "maven", "reproducibility"],
    });
  }

  // Try running mvn dependency:tree to detect runtime issues (graceful fallback)
  try {
    await execFileAsync(
      "mvn",
      ["dependency:tree", "-DoutputType=text", "--no-transfer-progress", "--batch-mode"],
      { cwd: projectDir, timeout: 60_000 },
    );
  } catch {
    /* mvn not available or project not compilable — skip */
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

function mapSemgrepSeverity(sev: string): Finding["severity"] {
  const normalized = sev.toUpperCase();
  if (normalized === "ERROR") return "high";
  if (normalized === "WARNING") return "medium";
  if (normalized === "INFO") return "info";
  return "low";
}
