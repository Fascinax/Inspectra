import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { mkdirSync, writeFileSync, rmSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { checkNamingConventions, checkFileLengths, checkTodoFixmes } from "../tools/code-quality.js";

function makeTempDir(): string {
  const dir = join(tmpdir(), `inspectra-test-${Date.now()}-${Math.random().toString(36).slice(2)}`);
  mkdirSync(dir, { recursive: true });
  return dir;
}

describe("checkFileLengths", () => {
  let tempDir: string;

  beforeEach(() => { tempDir = makeTempDir(); });
  afterEach(() => { rmSync(tempDir, { recursive: true, force: true }); });

  it("flags files exceeding the default warning threshold (400 lines)", async () => {
    const content = Array(450).fill("const x = 1;").join("\n");
    writeFileSync(join(tempDir, "big.ts"), content);

    const findings = await checkFileLengths(tempDir);
    expect(findings.length).toBe(1);
    expect(findings[0].rule).toBe("file-too-long");
    expect(findings[0].severity).toBe("medium");
  });

  it("flags files exceeding the error threshold as high severity", async () => {
    const content = Array(900).fill("const x = 1;").join("\n");
    writeFileSync(join(tempDir, "huge.ts"), content);

    const findings = await checkFileLengths(tempDir);
    expect(findings[0].severity).toBe("high");
  });

  it("uses profile thresholds when provided", async () => {
    const content = Array(250).fill("const x = 1;").join("\n");
    writeFileSync(join(tempDir, "medium.ts"), content);

    const defaultFindings = await checkFileLengths(tempDir);
    expect(defaultFindings.length).toBe(0);

    const strictProfile = { profile: "strict", file_lengths: { warning: 200, error: 500 } };
    const strictFindings = await checkFileLengths(tempDir, strictProfile);
    expect(strictFindings.length).toBe(1);
  });

  it("ignores files below threshold", async () => {
    writeFileSync(join(tempDir, "small.ts"), "export const x = 1;\n");
    const findings = await checkFileLengths(tempDir);
    expect(findings.length).toBe(0);
  });

  it("skips non-source files", async () => {
    const content = Array(500).fill("hello").join("\n");
    writeFileSync(join(tempDir, "readme.md"), content);
    const findings = await checkFileLengths(tempDir);
    expect(findings.length).toBe(0);
  });
});

describe("checkTodoFixmes", () => {
  let tempDir: string;

  beforeEach(() => { tempDir = makeTempDir(); });
  afterEach(() => { rmSync(tempDir, { recursive: true, force: true }); });

  it("detects TODO comments", async () => {
    writeFileSync(join(tempDir, "app.ts"), "// TODO: implement auth\nconst x = 1;\n");
    const findings = await checkTodoFixmes(tempDir);
    expect(findings.length).toBe(1);
    expect(findings[0].title).toContain("TODO");
    expect(findings[0].severity).toBe("low");
  });

  it("detects FIXME as medium severity", async () => {
    writeFileSync(join(tempDir, "app.ts"), "// FIXME: critical bug\n");
    const findings = await checkTodoFixmes(tempDir);
    expect(findings.length).toBe(1);
    expect(findings[0].severity).toBe("medium");
  });

  it("detects HACK and XXX as medium severity", async () => {
    writeFileSync(join(tempDir, "app.ts"), "// HACK: temp workaround\n// XXX: fragile code\n");
    const findings = await checkTodoFixmes(tempDir);
    expect(findings.length).toBe(2);
    expect(findings[0].severity).toBe("medium");
    expect(findings[1].severity).toBe("medium");
  });

  it("reports correct line numbers", async () => {
    writeFileSync(join(tempDir, "app.ts"), "line1\nline2\n// TODO: fix this\nline4\n");
    const findings = await checkTodoFixmes(tempDir);
    expect(findings[0].evidence?.[0]?.line).toBe(3);
  });

  it("returns empty for clean files", async () => {
    writeFileSync(join(tempDir, "clean.ts"), "export const x = 1;\n");
    const findings = await checkTodoFixmes(tempDir);
    expect(findings.length).toBe(0);
  });
});

describe("checkNamingConventions", () => {
  let tempDir: string;

  beforeEach(() => { tempDir = makeTempDir(); });
  afterEach(() => { rmSync(tempDir, { recursive: true, force: true }); });

  it("returns empty for files outside conventional directories", async () => {
    writeFileSync(join(tempDir, "utils.ts"), "export const x = 1;\n");
    const findings = await checkNamingConventions(tempDir);
    expect(findings.length).toBe(0);
  });

  it("flags files in conventional directories that don't follow convention", async () => {
    const servicesDir = join(tempDir, "services");
    mkdirSync(servicesDir, { recursive: true });
    writeFileSync(join(servicesDir, "helpers.ts"), "export function help() {}\n");

    const findings = await checkNamingConventions(tempDir);
    expect(findings.length).toBe(1);
    expect(findings[0].rule).toBe("file-naming-convention");
  });

  it("accepts files matching Angular naming pattern", async () => {
    const servicesDir = join(tempDir, "services");
    mkdirSync(servicesDir, { recursive: true });
    writeFileSync(join(servicesDir, "auth.service.ts"), "export class AuthService {}\n");

    const findings = await checkNamingConventions(tempDir);
    expect(findings.length).toBe(0);
  });
});
