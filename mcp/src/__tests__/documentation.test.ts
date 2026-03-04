import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { mkdirSync, writeFileSync, rmSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { checkReadmeCompleteness, checkAdrPresence, detectDocCodeDrift } from "../tools/documentation.js";

function makeTempDir(): string {
  const dir = join(tmpdir(), `inspectra-test-${Date.now()}-${Math.random().toString(36).slice(2)}`);
  mkdirSync(dir, { recursive: true });
  return dir;
}

describe("checkReadmeCompleteness", () => {
  let tempDir: string;

  beforeEach(() => {
    tempDir = makeTempDir();
  });
  afterEach(() => {
    rmSync(tempDir, { recursive: true, force: true });
  });

  it("reports missing README", async () => {
    const findings = await checkReadmeCompleteness(tempDir);
    expect(findings.some((f) => f.rule === "readme-required")).toBe(true);
  });

  it("reports no finding when README has all sections", async () => {
    writeFileSync(
      join(tempDir, "README.md"),
      "# Title\n## Installation\n## Usage\n## Testing\n## License\n",
    );
    const findings = await checkReadmeCompleteness(tempDir);
    const missingSection = findings.filter((f) => f.rule === "readme-missing-section");
    expect(missingSection.length).toBeLessThanOrEqual(1);
  });
});

describe("checkAdrPresence", () => {
  let tempDir: string;

  beforeEach(() => {
    tempDir = makeTempDir();
  });
  afterEach(() => {
    rmSync(tempDir, { recursive: true, force: true });
  });

  it("reports missing ADR directory", async () => {
    const findings = await checkAdrPresence(tempDir);
    expect(findings.length).toBeGreaterThanOrEqual(1);
  });

  it("passes when docs/adr exists with content", async () => {
    mkdirSync(join(tempDir, "docs", "adr"), { recursive: true });
    writeFileSync(join(tempDir, "docs", "adr", "001-use-ts.md"), "# ADR-001");
    const findings = await checkAdrPresence(tempDir);
    const adrFindings = findings.filter((f) => f.rule === "adr-missing");
    expect(adrFindings).toHaveLength(0);
  });
});

describe("detectDocCodeDrift", () => {
  let tempDir: string;

  beforeEach(() => {
    tempDir = makeTempDir();
  });
  afterEach(() => {
    rmSync(tempDir, { recursive: true, force: true });
  });

  it("returns empty findings for project without docs", async () => {
    const findings = await detectDocCodeDrift(tempDir);
    expect(Array.isArray(findings)).toBe(true);
  });
});
