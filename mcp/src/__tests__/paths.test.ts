import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { mkdirSync, writeFileSync, rmSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { validateProjectDir, validateFilePathsCsv } from "../utils/paths.js";

function makeTempDir(): string {
  const dir = join(tmpdir(), `inspectra-test-${Date.now()}-${Math.random().toString(36).slice(2)}`);
  mkdirSync(dir, { recursive: true });
  return dir;
}

describe("validateProjectDir", () => {
  let tempDir: string;

  beforeEach(() => {
    tempDir = makeTempDir();
  });
  afterEach(() => {
    rmSync(tempDir, { recursive: true, force: true });
  });

  it("accepts a valid directory path", async () => {
    const result = await validateProjectDir(tempDir);
    expect(result).toBe(tempDir);
  });

  it("rejects a non-existent path", async () => {
    await expect(validateProjectDir(join(tempDir, "nope"))).rejects.toThrow(/does not exist/);
  });

  it("rejects a file path", async () => {
    const file = join(tempDir, "file.txt");
    writeFileSync(file, "hi");
    await expect(validateProjectDir(file)).rejects.toThrow(/must be a directory/);
  });

  it("rejects paths with shell metacharacters", async () => {
    await expect(validateProjectDir(tempDir + ";rm -rf")).rejects.toThrow(/forbidden characters/);
  });
});

describe("validateFilePathsCsv", () => {
  let tempDir: string;

  beforeEach(() => {
    tempDir = makeTempDir();
  });
  afterEach(() => {
    rmSync(tempDir, { recursive: true, force: true });
  });

  it("validates a comma-separated list of file paths", async () => {
    const f1 = join(tempDir, "a.ts");
    const f2 = join(tempDir, "b.ts");
    writeFileSync(f1, "");
    writeFileSync(f2, "");
    const result = await validateFilePathsCsv(`${f1},${f2}`);
    expect(result).toEqual([f1, f2]);
  });

  it("strips empty entries", async () => {
    const f = join(tempDir, "x.ts");
    writeFileSync(f, "");
    const result = await validateFilePathsCsv(`${f}, ,`);
    expect(result).toHaveLength(1);
  });

  it("rejects directories in the list", async () => {
    await expect(validateFilePathsCsv(tempDir)).rejects.toThrow(/must be a file/);
  });
});
