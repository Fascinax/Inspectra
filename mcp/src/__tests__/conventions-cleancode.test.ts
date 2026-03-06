import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { mkdirSync, writeFileSync, rmSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import {
  checkFunctionLengths,
  checkParamCounts,
  checkMagicNumbers,
} from "../tools/conventions-cleancode.js";

function makeTempDir(): string {
  const dir = join(tmpdir(), `inspectra-cleancode-${Date.now()}-${Math.random().toString(36).slice(2)}`);
  mkdirSync(dir, { recursive: true });
  return dir;
}

/* ================================================================== */
/*  checkFunctionLengths                                               */
/* ================================================================== */

describe("checkFunctionLengths", () => {
  let tempDir: string;

  beforeEach(() => {
    tempDir = makeTempDir();
  });

  afterEach(() => {
    rmSync(tempDir, { recursive: true, force: true });
  });

  it("returns empty when no source files exist", async () => {
    const findings = await checkFunctionLengths(tempDir);
    expect(findings).toEqual([]);
  });

  it("returns empty for short functions", async () => {
    const code = [
      "function short() {",
      "  const a = 1;",
      "  return a;",
      "}",
    ].join("\n");
    writeFileSync(join(tempDir, "short.ts"), code);

    const findings = await checkFunctionLengths(tempDir);
    expect(findings).toEqual([]);
  });

  it("flags functions exceeding the warning threshold", async () => {
    const lines = ["function longFn() {"];
    for (let i = 0; i < 35; i++) {
      lines.push(`  const x${i} = ${i};`);
    }
    lines.push("}");
    writeFileSync(join(tempDir, "long.ts"), lines.join("\n"));

    const findings = await checkFunctionLengths(tempDir);
    expect(findings.length).toBeGreaterThanOrEqual(1);
    expect(findings[0].rule).toBe("function-too-long");
    expect(findings[0].severity).toBe("medium");
    expect(findings[0].domain).toBe("conventions");
    expect(findings[0].source).toBe("tool");
  });

  it("flags functions exceeding the error threshold as high severity", async () => {
    const lines = ["function veryLongFn() {"];
    for (let i = 0; i < 65; i++) {
      lines.push(`  const y${i} = ${i};`);
    }
    lines.push("}");
    writeFileSync(join(tempDir, "verylong.ts"), lines.join("\n"));

    const findings = await checkFunctionLengths(tempDir);
    expect(findings.length).toBeGreaterThanOrEqual(1);
    expect(findings[0].severity).toBe("high");
  });

  it("assigns CNV-3xx IDs to findings", async () => {
    const lines = ["function bigOne() {"];
    for (let i = 0; i < 40; i++) {
      lines.push(`  console.log(${i});`);
    }
    lines.push("}");
    writeFileSync(join(tempDir, "big.ts"), lines.join("\n"));

    const findings = await checkFunctionLengths(tempDir);
    expect(findings.length).toBeGreaterThanOrEqual(1);
    expect(findings[0].id).toMatch(/^CNV-3\d{2}$/);
  });

  it("detects Java methods", async () => {
    const lines = ["  public void processData(String input) {"];
    for (let i = 0; i < 35; i++) {
      lines.push(`    int x${i} = ${i};`);
    }
    lines.push("  }");
    writeFileSync(join(tempDir, "Service.java"), lines.join("\n"));

    const findings = await checkFunctionLengths(tempDir);
    expect(findings.length).toBeGreaterThanOrEqual(1);
    expect(findings[0].title).toContain("processData");
  });

  it("skips test infrastructure directories", async () => {
    const testDir = join(tempDir, "__tests__");
    mkdirSync(testDir, { recursive: true });

    const lines = ["function testHelper() {"];
    for (let i = 0; i < 40; i++) {
      lines.push(`  const t${i} = ${i};`);
    }
    lines.push("}");
    writeFileSync(join(testDir, "helper.ts"), lines.join("\n"));

    const findings = await checkFunctionLengths(tempDir);
    expect(findings).toEqual([]);
  });
});

/* ================================================================== */
/*  checkParamCounts                                                   */
/* ================================================================== */

describe("checkParamCounts", () => {
  let tempDir: string;

  beforeEach(() => {
    tempDir = makeTempDir();
  });

  afterEach(() => {
    rmSync(tempDir, { recursive: true, force: true });
  });

  it("returns empty when no source files exist", async () => {
    const findings = await checkParamCounts(tempDir);
    expect(findings).toEqual([]);
  });

  it("returns empty for functions with few params", async () => {
    const code = "function ok(a: string, b: number) { return a + b; }\n";
    writeFileSync(join(tempDir, "ok.ts"), code);

    const findings = await checkParamCounts(tempDir);
    expect(findings).toEqual([]);
  });

  it("flags functions with more than 3 parameters", async () => {
    const code = "function tooMany(a: string, b: number, c: boolean, d: string) { return a; }\n";
    writeFileSync(join(tempDir, "many.ts"), code);

    const findings = await checkParamCounts(tempDir);
    expect(findings.length).toBeGreaterThanOrEqual(1);
    expect(findings[0].rule).toBe("too-many-params");
    expect(findings[0].severity).toBe("medium");
    expect(findings[0].domain).toBe("conventions");
  });

  it("flags functions with more than 5 params as high severity", async () => {
    const code = "function way(a: string, b: number, c: boolean, d: string, e: number, f: boolean) { return a; }\n";
    writeFileSync(join(tempDir, "way.ts"), code);

    const findings = await checkParamCounts(tempDir);
    expect(findings.length).toBeGreaterThanOrEqual(1);
    expect(findings[0].severity).toBe("high");
  });

  it("assigns CNV-35x IDs to findings", async () => {
    const code = "function params(a: string, b: number, c: boolean, d: object) { return a; }\n";
    writeFileSync(join(tempDir, "ids.ts"), code);

    const findings = await checkParamCounts(tempDir);
    expect(findings.length).toBeGreaterThanOrEqual(1);
    expect(findings[0].id).toMatch(/^CNV-35\d$/);
  });

  it("excludes self from Python parameter count", async () => {
    const code = "def my_method(self, a, b):\n    return a + b\n";
    writeFileSync(join(tempDir, "py_class.py"), code);

    const findings = await checkParamCounts(tempDir);
    expect(findings).toEqual([]);
  });

  it("detects Java methods with too many params", async () => {
    const code = "  public void doWork(String a, int b, boolean c, double d) {\n  }\n";
    writeFileSync(join(tempDir, "Worker.java"), code);

    const findings = await checkParamCounts(tempDir);
    expect(findings.length).toBeGreaterThanOrEqual(1);
    expect(findings[0].title).toContain("doWork");
  });
});

/* ================================================================== */
/*  checkMagicNumbers                                                  */
/* ================================================================== */

describe("checkMagicNumbers", () => {
  let tempDir: string;

  beforeEach(() => {
    tempDir = makeTempDir();
  });

  afterEach(() => {
    rmSync(tempDir, { recursive: true, force: true });
  });

  it("returns empty when no source files exist", async () => {
    const findings = await checkMagicNumbers(tempDir);
    expect(findings).toEqual([]);
  });

  it("ignores safe numbers like 0, 1, -1, 100", async () => {
    const code = [
      "let index = 0;",
      "let count = 1;",
      "let prev = -1;",
      "let percentage = 100;",
    ].join("\n");
    writeFileSync(join(tempDir, "safe.ts"), code);

    const findings = await checkMagicNumbers(tempDir);
    expect(findings).toEqual([]);
  });

  it("ignores const declarations", async () => {
    const code = "const TIMEOUT_MS = 3000;\nconst MAX_RETRIES = 5;\n";
    writeFileSync(join(tempDir, "consts.ts"), code);

    const findings = await checkMagicNumbers(tempDir);
    expect(findings).toEqual([]);
  });

  it("detects magic numbers in non-const contexts", async () => {
    const code = [
      "function compute(x: number) {",
      "  if (x > 42) {",
      '    return x * 3.14;',
      "  }",
      "  return x;",
      "}",
    ].join("\n");
    writeFileSync(join(tempDir, "magic.ts"), code);

    const findings = await checkMagicNumbers(tempDir);
    expect(findings.length).toBeGreaterThanOrEqual(1);
    expect(findings[0].rule).toBe("magic-number");
    expect(findings[0].domain).toBe("conventions");
    expect(findings[0].source).toBe("tool");
  });

  it("assigns CNV-4xx IDs to findings", async () => {
    const code = "let timeout = 5000;\n";
    writeFileSync(join(tempDir, "id_check.ts"), code);

    const findings = await checkMagicNumbers(tempDir);
    expect(findings.length).toBeGreaterThanOrEqual(1);
    expect(findings[0].id).toMatch(/^CNV-4\d{2}$/);
  });

  it("limits findings per file to 5", async () => {
    const lines: string[] = [];
    for (let i = 0; i < 20; i++) {
      lines.push(`if (x > ${1000 + i}) console.log(${2000 + i});`);
    }
    writeFileSync(join(tempDir, "flood.ts"), lines.join("\n"));

    const findings = await checkMagicNumbers(tempDir);
    expect(findings.length).toBeLessThanOrEqual(5);
  });

  it("skips import lines and comments", async () => {
    const code = [
      'import { something } from "./module-42";',
      "// The number 999 is just a comment",
      "/* Another 888 in a block comment */",
      "const x = 1;",
    ].join("\n");
    writeFileSync(join(tempDir, "skips.ts"), code);

    const findings = await checkMagicNumbers(tempDir);
    expect(findings).toEqual([]);
  });
});
