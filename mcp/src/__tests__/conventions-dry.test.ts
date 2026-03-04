import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { mkdirSync, writeFileSync, rmSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { detectDryViolations } from "../tools/conventions-dry.js";

function makeTempDir(): string {
  const dir = join(tmpdir(), `inspectra-dry-${Date.now()}-${Math.random().toString(36).slice(2)}`);
  mkdirSync(dir, { recursive: true });
  return dir;
}

describe("detectDryViolations", () => {
  let tempDir: string;

  beforeEach(() => {
    tempDir = makeTempDir();
  });

  afterEach(() => {
    rmSync(tempDir, { recursive: true, force: true });
  });

  it("returns empty when no source files exist", async () => {
    const findings = await detectDryViolations(tempDir);
    expect(findings).toEqual([]);
  });

  it("returns empty when no duplicated blocks exist", async () => {
    writeFileSync(join(tempDir, "a.ts"), "const a = 1;\nconst b = 2;\nconst c = 3;\n");
    writeFileSync(join(tempDir, "b.ts"), "const x = 10;\nconst y = 20;\nconst z = 30;\n");

    const findings = await detectDryViolations(tempDir);
    expect(findings).toEqual([]);
  });

  it("detects duplicated code blocks across files", async () => {
    const sharedBlock = [
      "function validate(input: string): boolean {",
      "  if (input.length === 0) return false;",
      "  const trimmed = input.trim();",
      "  const sanitized = trimmed.replace(/[^a-z]/gi, '');",
      "  if (sanitized.length < 3) return false;",
      "  return /^[a-zA-Z]+$/.test(sanitized);",
      "  console.log('validated');",
    ].join("\n");
    writeFileSync(join(tempDir, "a.ts"), sharedBlock + "\nexport const A = 1;");
    writeFileSync(join(tempDir, "b.ts"), "// different header\n" + sharedBlock + "\nexport const B = 2;");

    const findings = await detectDryViolations(tempDir);
    expect(findings.length).toBeGreaterThanOrEqual(1);
    expect(findings[0].rule).toBe("dry-violation");
    expect(findings[0].domain).toBe("conventions");
  });

  it("assigns CNV-2xx IDs to findings", async () => {
    const sharedBlock = [
      "function process(data: string[]): number {",
      "  let count = 0;",
      "  const filtered = data.filter(Boolean);",
      "  for (const item of filtered) {",
      "    if (item.length > 0) count++;",
      "    console.log(item, count);",
      "  return count + filtered.length;",
      "  const unused = 'placeholder for line count';",
    ].join("\n");
    writeFileSync(join(tempDir, "x.ts"), sharedBlock);
    writeFileSync(join(tempDir, "y.ts"), sharedBlock);

    const findings = await detectDryViolations(tempDir);
    expect(findings.length).toBeGreaterThanOrEqual(1);
    expect(findings[0].id).toMatch(/^CNV-2\d{2}$/);
  });
});
