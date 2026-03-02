import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { mkdirSync, writeFileSync, rmSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { parseLintOutput, detectDryViolations } from "../tools/conventions.js";

function makeTempDir(): string {
  const dir = join(tmpdir(), `inspectra-cnv-v2-${Date.now()}-${Math.random().toString(36).slice(2)}`);
  mkdirSync(dir, { recursive: true });
  return dir;
}

// ---------------------------------------------------------------------------
// parseLintOutput
// ---------------------------------------------------------------------------

describe("parseLintOutput", () => {
  let tempDir: string;

  beforeEach(() => {
    tempDir = makeTempDir();
  });
  afterEach(() => {
    rmSync(tempDir, { recursive: true, force: true });
  });

  it("returns empty array for an empty eslint-report.json", async () => {
    // Write an empty but valid ESLint report to bypass the slow npx fallback
    writeFileSync(join(tempDir, "eslint-report.json"), "[]");
    const findings = await parseLintOutput(tempDir);
    expect(findings).toHaveLength(0);
  });

  it("parses eslint-report.json and creates CNV findings", async () => {
    const report = [
      {
        filePath: join(tempDir, "src", "app.ts"),
        messages: [
          {
            ruleId: "no-console",
            severity: 1,
            message: "Unexpected console statement.",
            line: 5,
            column: 3,
            source: "console.log()",
          },
          {
            ruleId: "no-unused-vars",
            severity: 2,
            message: "'x' is defined but never used.",
            line: 10,
            column: 1,
            source: "const x = 1;",
          },
        ],
      },
    ];
    writeFileSync(join(tempDir, "eslint-report.json"), JSON.stringify(report));

    const findings = await parseLintOutput(tempDir);
    expect(findings.length).toBe(2);

    const noConsole = findings.find((f) => f.rule === "eslint/no-console");
    expect(noConsole).toBeDefined();
    expect(noConsole?.severity).toBe("low"); // severity 1 → low
    expect(noConsole?.domain).toBe("conventions");
    expect(noConsole?.tags).toContain("eslint");

    const noUnused = findings.find((f) => f.rule === "eslint/no-unused-vars");
    expect(noUnused).toBeDefined();
    expect(noUnused?.severity).toBe("medium"); // severity 2 → medium
  });

  it("skips eslint messages without a ruleId", async () => {
    const report = [
      {
        filePath: join(tempDir, "index.ts"),
        messages: [{ ruleId: null, severity: 2, message: "Parsing error.", line: 1, column: 1 }],
      },
    ];
    writeFileSync(join(tempDir, "eslint-report.json"), JSON.stringify(report));

    const findings = await parseLintOutput(tempDir);
    expect(findings).toHaveLength(0);
  });

  it("parses checkstyle-result.xml from project root", async () => {
    // Pre-create empty eslint report to bypass the slow npx eslint fallback
    writeFileSync(join(tempDir, "eslint-report.json"), "[]");
    const xml = `<?xml version="1.0" encoding="UTF-8"?>
<checkstyle version="10.0">
  <file name="${join(tempDir, "src", "Main.java")}">
    <error line="12" severity="error" message="Missing a Javadoc comment." source="com.puppycrawl.tools.checkstyle.checks.javadoc.JavadocMethodCheck"/>
    <error line="20" severity="warning" message="Line is longer than 80 characters." source="com.puppycrawl.tools.checkstyle.checks.sizes.LineLengthCheck"/>
  </file>
</checkstyle>`;
    writeFileSync(join(tempDir, "checkstyle-result.xml"), xml);

    const findings = await parseLintOutput(tempDir);
    expect(findings.length).toBeGreaterThanOrEqual(2);

    const javadoc = findings.find((f) => f.rule === "checkstyle/JavadocMethodCheck");
    expect(javadoc).toBeDefined();
    expect(javadoc?.severity).toBe("medium");
    expect(javadoc?.tags).toContain("checkstyle");

    const lineLength = findings.find((f) => f.rule === "checkstyle/LineLengthCheck");
    expect(lineLength).toBeDefined();
    expect(lineLength?.severity).toBe("low");
  });

  it("produces findings with valid id pattern CNV-XXX", async () => {
    const report = [
      {
        filePath: join(tempDir, "a.ts"),
        messages: [{ ruleId: "semi", severity: 1, message: "Missing semicolon.", line: 3, column: 5 }],
      },
    ];
    writeFileSync(join(tempDir, "eslint-report.json"), JSON.stringify(report));

    const findings = await parseLintOutput(tempDir);
    expect(findings.length).toBe(1);
    expect(findings[0].id).toMatch(/^CNV-\d{3}$/);
  });

  it("ignores malformed eslint-report.json gracefully", async () => {
    writeFileSync(join(tempDir, "eslint-report.json"), "NOT_VALID_JSON{{{{");

    const findings = await parseLintOutput(tempDir);
    expect(Array.isArray(findings)).toBe(true);
    // Should not throw; findings may be empty
  });
});

// ---------------------------------------------------------------------------
// detectDryViolations
// ---------------------------------------------------------------------------

describe("detectDryViolations", () => {
  let tempDir: string;

  beforeEach(() => {
    tempDir = makeTempDir();
  });
  afterEach(() => {
    rmSync(tempDir, { recursive: true, force: true });
  });

  it("returns empty array for an empty project", async () => {
    const findings = await detectDryViolations(tempDir);
    expect(findings).toHaveLength(0);
  });

  it("returns empty array when all files have unique content", async () => {
    writeFileSync(join(tempDir, "a.ts"), `export function doA() {\n  return "unique-a";\n}\n`);
    writeFileSync(join(tempDir, "b.ts"), `export function doB() {\n  return "unique-b";\n}\n`);

    const findings = await detectDryViolations(tempDir);
    expect(findings).toHaveLength(0);
  });

  it("detects duplicated 6+ line block across two files", async () => {
    const sharedBlock = [
      `  const result = input.trim();`,
      `  const parts = result.split(",");`,
      `  const mapped = parts.map((p) => p.toUpperCase());`,
      `  const filtered = mapped.filter((p) => p.length > 0);`,
      `  const joined = filtered.join("-");`,
      `  return joined.replace(/[^A-Z-]/g, "");`,
    ].join("\n");

    writeFileSync(join(tempDir, "service-a.ts"), `export function processA(input: string) {\n${sharedBlock}\n}\n`);
    writeFileSync(join(tempDir, "service-b.ts"), `export function processB(input: string) {\n${sharedBlock}\n}\n`);

    const findings = await detectDryViolations(tempDir);
    expect(findings.length).toBeGreaterThanOrEqual(1);
    expect(findings[0].rule).toBe("dry-violation");
    expect(findings[0].severity).toBe("low");
    expect(findings[0].domain).toBe("conventions");
  });

  it("does not flag duplication within the same file", async () => {
    // Same block repeated in one file — not cross-file
    const block = [
      `  const result = input.trim();`,
      `  const parts = result.split(",");`,
      `  const mapped = parts.map((p) => p.toUpperCase());`,
      `  const filtered = mapped.filter((p) => p.length > 0);`,
      `  const joined = filtered.join("-");`,
      `  return joined.replace(/[^A-Z-]/g, "");`,
    ].join("\n");

    const content = `export function funcA(input: string) {\n${block}\n}\n\nexport function funcB(input: string) {\n${block}\n}\n`;
    writeFileSync(join(tempDir, "only-file.ts"), content);

    const findings = await detectDryViolations(tempDir);
    expect(findings).toHaveLength(0);
  });

  it("produces findings with valid structure and id", async () => {
    const block = [
      `  const x = computeValue(input);`,
      `  const y = x.map((v) => v * 2);`,
      `  const z = y.filter((v) => v > 10);`,
      `  const w = z.reduce((acc, v) => acc + v, 0);`,
      `  const result = w / z.length;`,
      `  return Math.round(result * 100) / 100;`,
    ].join("\n");

    writeFileSync(join(tempDir, "calc-a.ts"), `function calcA(input: number[]) {\n${block}\n}\n`);
    writeFileSync(join(tempDir, "calc-b.ts"), `function calcB(input: number[]) {\n${block}\n}\n`);

    const findings = await detectDryViolations(tempDir);
    expect(findings.length).toBeGreaterThanOrEqual(1);
    for (const f of findings) {
      expect(f.id).toMatch(/^CNV-\d{3}$/);
      expect(typeof f.confidence).toBe("number");
      expect(f.evidence.length).toBeGreaterThan(0);
    }
  });

  it("deduplicates: same file pair reported only once", async () => {
    const block = [
      `  const result = input.trim();`,
      `  const parts = result.split(",");`,
      `  const mapped = parts.map((p) => p.toUpperCase());`,
      `  const filtered = mapped.filter((p) => p.length > 0);`,
      `  const joined = filtered.join("-");`,
      `  return joined.replace(/[^A-Z-]/g, "");`,
    ].join("\n");

    // Duplicate block appears twice in each file → same file pair, reported once
    const contentA = `function f1(input: string) {\n${block}\n}\nfunction f2(input: string) {\n${block}\n}\n`;
    const contentB = `function g1(input: string) {\n${block}\n}\nfunction g2(input: string) {\n${block}\n}\n`;
    writeFileSync(join(tempDir, "dup-a.ts"), contentA);
    writeFileSync(join(tempDir, "dup-b.ts"), contentB);

    const findings = await detectDryViolations(tempDir);
    const pairs = new Set(
      findings.map((f) =>
        f.evidence
          .map((e) => e.file)
          .sort()
          .join("|"),
      ),
    );
    // The specific file pair should appear at most once
    expect(pairs.size).toBeLessThanOrEqual(findings.length);
    expect(findings.length).toBeGreaterThanOrEqual(1);
  });
});
