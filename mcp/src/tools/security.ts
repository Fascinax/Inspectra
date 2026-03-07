import { execFile } from "node:child_process";
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { promisify } from "node:util";
import type { Finding } from "../types.js";
import { createIdSequence } from "../utils/id.js";
import { logger } from "../logger.js";

export { scanSecrets, scanSecretsInDir, SECRET_PATTERNS } from "./security-secrets.js";

const execFileAsync = promisify(execFile);

const MAX_DESCRIPTION_LENGTH = 500;
const MAX_SNIPPET_LENGTH = 120;
const PROCESS_TIMEOUT_MS = 30_000;

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
      ({ stdout } = await execFileAsync("npm", ["audit", "--json"], { cwd: projectDir, timeout: PROCESS_TIMEOUT_MS }));
    } catch (err: unknown) {
      // npm audit exits non-zero when vulnerabilities are found — stdout still contains JSON
      const execError = err as { stdout?: string };
      stdout = execError.stdout ?? "";
      if (!stdout) return findings;
    }

    const audit = JSON.parse(stdout);

    const nextId = createIdSequence("SEC", 101);
    const vulnerabilities = audit.vulnerabilities ?? {};

    for (const [pkgName, vuln] of Object.entries<Record<string, unknown>>(vulnerabilities)) {
      const severity = mapNpmSeverity(vuln.severity as string);
      findings.push({
        id: nextId(),
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
        source: "tool",
      });
    }
  } catch (err) {
    logger.warn("checkDependencyVulnerabilities: npm audit failed or unavailable", { error: String(err) });
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
      ({ stdout } = await execFileAsync("semgrep", ["--json", "--config", "auto", "--quiet", projectDir], {
        timeout: 120_000,
        cwd: projectDir,
      }));
    } catch (err: unknown) {
      const e = err as { stdout?: string };
      stdout = e.stdout ?? "";
      if (!stdout) return [];
    }

    const data = JSON.parse(stdout) as { results?: SemgrepResult[] };
    const results = data.results ?? [];
    const nextId = createIdSequence("SEC", 200);

    return results.map((r) => ({
      id: nextId(),
      severity: mapSemgrepSeverity(r.extra.severity),
      title: `Semgrep: ${r.check_id.split(".").slice(-2).join(".")}`,
      description: r.extra.message.substring(0, MAX_DESCRIPTION_LENGTH),
      domain: "security" as const,
      rule: `semgrep/${r.check_id}`,
      confidence: 0.9,
      evidence: [{ file: r.path, line: r.start.line, snippet: r.extra.lines?.trim().substring(0, MAX_SNIPPET_LENGTH) }],
      recommendation: r.extra.fix ?? "Review and address the flagged pattern.",
      effort: "small" as const,
      tags: ["semgrep", r.check_id.split(".")[0] ?? r.check_id],
      source: "tool" as const,
    }));
  } catch (err) {
    logger.warn("runSemgrep: unexpected error during scan", { error: String(err) });
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
  const nextId = createIdSequence("SEC", 300);

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
      id: nextId(),
      severity: "medium",
      title: `High Maven dependency count: ${depCount} dependencies`,
      description: `The pom.xml declares ${depCount} dependencies. A high count increases supply chain risk and build complexity.`,
      domain: "security",
      rule: "excessive-maven-dependencies",
      confidence: 0.9,
      evidence: [{ file: "pom.xml" }],
      recommendation:
        "Audit dependencies and remove unused ones. Run `mvn dependency:analyze` to find unused declarations.",
      effort: "medium",
      tags: ["dependencies", "maven"],
      source: "tool",
    });
  }

  // Detect SNAPSHOT dependencies in production scope
  const snapshotPattern = /<version>([^<]*-SNAPSHOT[^<]*)<\/version>/g;
  let snapshotMatch: RegExpExecArray | null;
  while ((snapshotMatch = snapshotPattern.exec(pomContent)) !== null) {
    const version = snapshotMatch[1];
    findings.push({
      id: nextId(),
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
      source: "tool",
    });
  }

  // Try running mvn dependency:tree to detect runtime issues (graceful fallback)
  try {
    await execFileAsync("mvn", ["dependency:tree", "-DoutputType=text", "--no-transfer-progress", "--batch-mode"], {
      cwd: projectDir,
      timeout: 60_000,
    });
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
  if (normalized === "CRITICAL") return "critical";
  if (normalized === "ERROR") return "high";
  if (normalized === "WARNING") return "medium";
  if (normalized === "INFO") return "info";
  return "low";
}
