import { readFile, readdir } from "node:fs/promises";
import { join, relative } from "node:path";
import type { Finding } from "../types.js";
import { createIdSequence } from "../utils/id.js";

/**
 * Check README for baseline sections expected in maintainable repositories.
 */
export async function checkReadmeCompleteness(projectDir: string): Promise<Finding[]> {
  const findings: Finding[] = [];
  const nextId = createIdSequence("DOC");
  const readmePath = join(projectDir, "README.md");

  let content: string;
  try {
    content = await readFile(readmePath, "utf-8");
  } catch {
    return [
      {
        id: nextId(),
        severity: "high",
        title: "README.md is missing",
        description: "Project has no root README, which makes onboarding and usage harder.",
        domain: "documentation",
        rule: "readme-required",
        confidence: 1,
        evidence: [{ file: "README.md" }],
        recommendation: "Add a README with setup, usage, and testing instructions.",
        effort: "small",
        tags: ["readme", "onboarding"],
        source: "tool",
      },
    ];
  }

  const requiredSections = ["installation", "usage", "testing"];
  const lowered = content.toLowerCase();

  for (const section of requiredSections) {
    if (lowered.includes(section)) continue;
    findings.push({
      id: nextId(),
      severity: "medium",
      title: `README missing section: ${section}`,
      description: `The README does not appear to include a '${section}' section.`,
      domain: "documentation",
      rule: "readme-section-missing",
      confidence: 0.9,
      evidence: [{ file: relative(projectDir, readmePath) }],
      recommendation: `Add a '${section}' section to improve discoverability for contributors and users.`,
      effort: "trivial",
      tags: ["readme"],
      source: "tool",
    });
  }

  return findings;
}

/**
 * Ensure ADR directory exists and contains at least one ADR markdown document.
 */
export async function checkAdrPresence(projectDir: string): Promise<Finding[]> {
  const nextId = createIdSequence("DOC", 100);
  const candidates = [join(projectDir, "docs", "adr"), join(projectDir, "docs", "adrs")];

  for (const candidate of candidates) {
    try {
      const entries = await readdir(candidate, { withFileTypes: true });
      const hasAdr = entries.some((entry) => entry.isFile() && /\.md$/i.test(entry.name));
      if (hasAdr) return [];
    } catch {
      /* try next dir */
    }
  }

  return [
    {
      id: nextId(),
      severity: "low",
      title: "No ADR documents found",
      description: "No architecture decision records detected in docs/adr or docs/adrs.",
      domain: "documentation",
      rule: "adr-missing",
      confidence: 0.9,
      evidence: [{ file: "docs/adr" }],
      recommendation: "Add ADRs for major architecture and technology decisions.",
      effort: "small",
      tags: ["adr", "architecture-docs"],
      source: "tool",
    },
  ];
}

/**
 * Detect basic documentation drift by comparing package scripts with README command mentions.
 */
export async function detectDocCodeDrift(projectDir: string): Promise<Finding[]> {
  const findings: Finding[] = [];
  const nextId = createIdSequence("DOC", 200);

  let packageJsonRaw = "";
  let readmeRaw = "";
  try {
    packageJsonRaw = await readFile(join(projectDir, "package.json"), "utf-8");
    readmeRaw = await readFile(join(projectDir, "README.md"), "utf-8");
  } catch {
    return findings;
  }

  try {
    const packageJson = JSON.parse(packageJsonRaw) as { scripts?: Record<string, string> };
    const scripts = packageJson.scripts ?? {};
    const readmeLower = readmeRaw.toLowerCase();

    const criticalScripts = ["build", "test", "lint"];
    for (const scriptName of criticalScripts) {
      if (!scripts[scriptName]) continue;
      const expected = `npm run ${scriptName}`;
      if (readmeLower.includes(expected)) continue;

      findings.push({
        id: nextId(),
        severity: "low",
        title: `README may be stale for script: ${scriptName}`,
        description: `Script '${scriptName}' exists in package.json but '${expected}' is not referenced in README.`,
        domain: "documentation",
        rule: "doc-code-drift",
        confidence: 0.75,
        evidence: [{ file: "package.json", snippet: `scripts.${scriptName}` }, { file: "README.md" }],
        recommendation: `Document how to run '${expected}' in README to keep docs aligned with code.`,
        effort: "trivial",
        tags: ["drift", "readme"],
        source: "tool",
      });
    }
  } catch {
    return findings;
  }

  return findings;
}
