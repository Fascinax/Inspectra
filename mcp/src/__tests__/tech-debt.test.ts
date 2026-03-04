import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { mkdirSync, writeFileSync, rmSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { analyzeComplexity, ageTodos, checkDependencyStaleness } from "../tools/tech-debt.js";

function makeTempDir(): string {
  const dir = join(tmpdir(), `inspectra-test-${Date.now()}-${Math.random().toString(36).slice(2)}`);
  mkdirSync(dir, { recursive: true });
  return dir;
}

describe("analyzeComplexity", () => {
  let tempDir: string;

  beforeEach(() => {
    tempDir = makeTempDir();
    mkdirSync(join(tempDir, "src"), { recursive: true });
  });
  afterEach(() => {
    rmSync(tempDir, { recursive: true, force: true });
  });

  it("returns empty findings for simple files", async () => {
    writeFileSync(join(tempDir, "src", "simple.ts"), 'export const x = 1;\n');
    const findings = await analyzeComplexity(tempDir);
    expect(findings).toEqual([]);
  });

  it("flags files with high branch complexity", async () => {
    const branches = Array.from({ length: 40 }, (_, i) => `if (x === ${i}) { y++; }`).join("\n");
    writeFileSync(join(tempDir, "src", "complex.ts"), branches);
    const findings = await analyzeComplexity(tempDir);
    expect(findings.some((f) => f.rule === "high-complexity")).toBe(true);
  });
});

describe("ageTodos", () => {
  let tempDir: string;

  beforeEach(() => {
    tempDir = makeTempDir();
    mkdirSync(join(tempDir, "src"), { recursive: true });
  });
  afterEach(() => {
    rmSync(tempDir, { recursive: true, force: true });
  });

  it("returns empty findings when no TODOs exist", async () => {
    writeFileSync(join(tempDir, "src", "clean.ts"), 'export const x = 1;\n');
    const findings = await ageTodos(tempDir);
    expect(findings).toEqual([]);
  });

  it("detects old dated TODO comments in source files", async () => {
    writeFileSync(join(tempDir, "src", "dirty.ts"), '// TODO 2024-01-01: fix this later\nexport const x = 1;\n');
    const findings = await ageTodos(tempDir);
    expect(findings.some((f) => f.rule === "aged-todo")).toBe(true);
  });

  it("ignores TODO without a date", async () => {
    writeFileSync(join(tempDir, "src", "nodated.ts"), '// TODO: fix this later\nexport const x = 1;\n');
    const findings = await ageTodos(tempDir);
    expect(findings).toEqual([]);
  });

  it("ignores TODO inside string literals", async () => {
    writeFileSync(join(tempDir, "src", "safe.ts"), 'const msg = "TODO: buy groceries";\n');
    const findings = await ageTodos(tempDir);
    expect(findings).toEqual([]);
  });
});

describe("checkDependencyStaleness", () => {
  let tempDir: string;

  beforeEach(() => {
    tempDir = makeTempDir();
  });
  afterEach(() => {
    rmSync(tempDir, { recursive: true, force: true });
  });

  it("returns empty findings when no package.json exists", async () => {
    const findings = await checkDependencyStaleness(tempDir);
    expect(findings).toEqual([]);
  });
});
