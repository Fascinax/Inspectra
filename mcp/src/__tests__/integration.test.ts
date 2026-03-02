/**
 * Integration tests — exercise tool functions against the sample fixture project.
 *
 * These tests use a real (but minimal) project directory structure to verify
 * that the full audit pipeline correctly detects known issues in the fixture.
 */
import { describe, it, expect } from "vitest";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { checkFileLengths, checkTodoFixmes, checkNamingConventions } from "../tools/conventions.js";
import { detectMissingTests } from "../tools/tests.js";
import { scanSecrets } from "../tools/security.js";

const FIXTURE_DIR = resolve(dirname(fileURLToPath(import.meta.url)), "fixtures", "sample-project");

// ─── Conventions ─────────────────────────────────────────────────────────────

describe("Integration: checkFileLengths on fixture project", () => {
  it("detects the intentionally long math-utils.ts with a strict profile", async () => {
    const findings = await checkFileLengths(FIXTURE_DIR, {
      profile: "strict",
      file_lengths: { warning: 50, error: 200 },
    });
    const files = findings.map((f) => f.evidence[0]?.file ?? "");
    expect(files.some((f) => f.includes("math-utils"))).toBe(true);
  });

  it("emits no findings against the default threshold (files are short)", async () => {
    // All fixture files except math-utils are well under 400 lines
    const findings = await checkFileLengths(FIXTURE_DIR);
    const longFiles = findings.filter((f) => !f.evidence[0]?.file.includes("math-utils"));
    expect(longFiles.length).toBe(0);
  });

  it("returns findings with required finding contract fields", async () => {
    const findings = await checkFileLengths(FIXTURE_DIR, {
      profile: "strict",
      file_lengths: { warning: 50, error: 200 },
    });
    expect(findings.length).toBeGreaterThan(0);
    for (const f of findings) {
      expect(f.id).toMatch(/^CNV-\d{3}$/);
      expect(["critical", "high", "medium", "low", "info"]).toContain(f.severity);
      expect(f.domain).toBe("conventions");
      expect(f.evidence.length).toBeGreaterThan(0);
      expect(f.confidence).toBeGreaterThanOrEqual(0);
      expect(f.confidence).toBeLessThanOrEqual(1);
    }
  });
});

describe("Integration: checkTodoFixmes on fixture project", () => {
  it("detects TODO comments in user.controller.ts", async () => {
    const findings = await checkTodoFixmes(FIXTURE_DIR);
    const rules = findings.map((f) => f.rule);
    expect(rules.every((r) => r === "unresolved-todo")).toBe(true);
    expect(findings.length).toBeGreaterThanOrEqual(2); // at least 2 TODO/FIXME
  });

  it("includes evidence with file path and line number", async () => {
    const findings = await checkTodoFixmes(FIXTURE_DIR);
    for (const f of findings) {
      expect(f.evidence[0]?.file).toBeTruthy();
      expect(f.evidence[0]?.line).toBeGreaterThan(0);
    }
  });
});

describe("Integration: checkNamingConventions on fixture project", () => {
  it("accepts Angular/service-named files without violations", async () => {
    // auth.service.ts and user.controller.ts follow conventions → no findings for them
    const findings = await checkNamingConventions(FIXTURE_DIR);
    const flaggedFiles = findings.map((f) => f.evidence[0]?.file ?? "");
    expect(flaggedFiles.every((f) => !f.includes("auth.service") && !f.includes("user.controller"))).toBe(true);
  });
});

// ─── Tests ───────────────────────────────────────────────────────────────────

describe("Integration: detectMissingTests on fixture project", () => {
  it("detects auth.service.ts as having no test file", async () => {
    const findings = await detectMissingTests(FIXTURE_DIR);
    const missingFiles = findings.map((f) => f.evidence[0]?.file ?? "");
    expect(missingFiles.some((f) => f.includes("auth.service"))).toBe(true);
  });

  it("does NOT flag math-utils.ts because math-utils.test.ts exists", async () => {
    const findings = await detectMissingTests(FIXTURE_DIR);
    const missingFiles = findings.map((f) => f.evidence[0]?.file ?? "");
    expect(missingFiles.every((f) => !f.includes("math-utils.ts"))).toBe(true);
  });

  it("returns findings with medium severity", async () => {
    const findings = await detectMissingTests(FIXTURE_DIR);
    expect(findings.length).toBeGreaterThan(0);
    expect(findings.every((f) => f.severity === "medium")).toBe(true);
  });
});

// ─── Security ────────────────────────────────────────────────────────────────

describe("Integration: scanSecrets on fixture project", () => {
  it("detects the hardcoded API key in auth.service.ts", async () => {
    const authServicePath = join(FIXTURE_DIR, "src", "services", "auth.service.ts");
    const findings = await scanSecrets([authServicePath]);
    expect(findings.length).toBeGreaterThan(0);
    expect(findings.every((f) => f.domain === "security")).toBe(true);
    expect(findings.every((f) => f.evidence[0]?.file === authServicePath)).toBe(true);
  });

  it("returns no secrets for a clean file", async () => {
    const cleanPath = join(FIXTURE_DIR, "src", "utils", "math-utils.ts");
    const findings = await scanSecrets([cleanPath]);
    expect(findings.length).toBe(0);
  });

  it("returns findings with correct contract shape", async () => {
    const authServicePath = join(FIXTURE_DIR, "src", "services", "auth.service.ts");
    const findings = await scanSecrets([authServicePath]);
    for (const f of findings) {
      expect(f.id).toMatch(/^SEC-\d{3}$/);
      expect(f.domain).toBe("security");
      expect(f.confidence).toBeGreaterThan(0);
      expect(f.evidence.length).toBeGreaterThan(0);
    }
  });
});
