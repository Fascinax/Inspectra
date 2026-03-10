import { readFile, readdir } from "node:fs/promises";
import { join, relative } from "node:path";
import type { Finding } from "../types.js";
import { collectSourceFiles } from "../utils/files.js";
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
  const recommendedSections = ["prerequisites", "contributing", "license", "architecture"];
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

  for (const section of recommendedSections) {
    if (lowered.includes(section)) continue;
    findings.push({
      id: nextId(),
      severity: "low",
      title: `README missing recommended section: ${section}`,
      description: `The README does not include a '${section}' section. While not strictly required, this section improves project discoverability and contributor onboarding.`,
      domain: "documentation",
      rule: "readme-recommended-section-missing",
      confidence: 0.80,
      evidence: [{ file: relative(projectDir, readmePath) }],
      recommendation: `Add a '${section}' section to the README.`,
      effort: "trivial",
      tags: ["readme", "onboarding"],
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

/**
 * Checks .env.example alignment: verifies that documented environment variables
 * are actually referenced in the source code, and flags stale entries.
 */
export async function detectEnvExampleDrift(projectDir: string): Promise<Finding[]> {
  const findings: Finding[] = [];
  const nextId = createIdSequence("DOC", 300);

  let exampleContent: string;
  try {
    exampleContent = await readFile(join(projectDir, ".env.example"), "utf-8");
  } catch {
    return findings; // no .env.example — skip silently
  }

  // Extract keys: lines matching KEY=... or KEY (no value)
  const envKeys = exampleContent
    .split("\n")
    .map((l) => l.trim())
    .filter((l) => l && !l.startsWith("#"))
    .map((l) => l.split("=")[0]?.trim() ?? "")
    .filter(Boolean);

  if (envKeys.length === 0) return findings;

  // Gather source file contents once
  let sourceFiles: string[] = [];
  try {
    sourceFiles = await collectSourceFiles(projectDir);
  } catch {
    return findings;
  }

  // For each key, check if it appears in source as process.env.KEY or @ConfigProperty
  const sourceContents: string[] = [];
  for (const f of sourceFiles) {
    try {
      sourceContents.push(await readFile(f, "utf-8"));
    } catch {
      /* skip unreadable */
    }
  }
  const combinedSource = sourceContents.join("\n");

  for (const key of envKeys) {
    const escaped = key.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    // Match process.env.KEY, env.KEY, System.getenv("KEY"), @ConfigProperty("KEY")
    const usagePattern = new RegExp(
      `process\.env\.${escaped}|env\.${escaped}|getenv\(.*["']${escaped}["']|@ConfigProperty\(.*["']${escaped}["']`,
    );
    if (!usagePattern.test(combinedSource)) {
      findings.push({
        id: nextId(),
        severity: "low",
        title: `Env var in .env.example not found in source: ${key}`,
        description: `The environment variable '${key}' is documented in .env.example but does not appear to be referenced in the source code. It may be stale.`,
        domain: "documentation",
        rule: "env-example-stale-key",
        confidence: 0.65,
        evidence: [{ file: ".env.example", snippet: key }],
        recommendation:
          `Remove '${key}' from .env.example if it is no longer used, or add the corresponding reference in source code.`,
        effort: "trivial",
        tags: ["drift", "env", "configuration"],
        source: "tool",
      });
    }
  }

  return findings;
}
