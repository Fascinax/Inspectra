import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { mkdirSync, writeFileSync, rmSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { collectSourceFiles, collectAllFiles } from "../utils/files.js";

function makeTempDir(): string {
  const dir = join(tmpdir(), `inspectra-test-${Date.now()}-${Math.random().toString(36).slice(2)}`);
  mkdirSync(dir, { recursive: true });
  return dir;
}

describe("collectSourceFiles", () => {
  let tempDir: string;

  beforeEach(() => {
    tempDir = makeTempDir();
    mkdirSync(join(tempDir, "src"), { recursive: true });
    writeFileSync(join(tempDir, "src", "app.ts"), "");
    writeFileSync(join(tempDir, "src", "util.js"), "");
    writeFileSync(join(tempDir, "src", "readme.md"), "");
    mkdirSync(join(tempDir, "node_modules", "dep"), { recursive: true });
    writeFileSync(join(tempDir, "node_modules", "dep", "index.js"), "");
  });

  afterEach(() => {
    rmSync(tempDir, { recursive: true, force: true });
  });

  it("collects .ts and .js files from source folders", async () => {
    const files = await collectSourceFiles(tempDir);
    expect(files).toHaveLength(2);
    expect(files.some((f) => f.endsWith("app.ts"))).toBe(true);
    expect(files.some((f) => f.endsWith("util.js"))).toBe(true);
  });

  it("ignores node_modules", async () => {
    const files = await collectSourceFiles(tempDir);
    expect(files.every((f) => !f.includes("node_modules"))).toBe(true);
  });

  it("ignores non-source extensions", async () => {
    const files = await collectSourceFiles(tempDir);
    expect(files.every((f) => !f.endsWith(".md"))).toBe(true);
  });

  it("supports custom extensions", async () => {
    writeFileSync(join(tempDir, "src", "data.json"), "{}");
    const files = await collectSourceFiles(tempDir, [".json"]);
    expect(files).toHaveLength(1);
    expect(files[0]).toContain("data.json");
  });
});

describe("collectAllFiles", () => {
  let tempDir: string;

  beforeEach(() => {
    tempDir = makeTempDir();
    mkdirSync(join(tempDir, "sub"), { recursive: true });
    writeFileSync(join(tempDir, "a.ts"), "");
    writeFileSync(join(tempDir, "sub", "b.md"), "");
  });

  afterEach(() => {
    rmSync(tempDir, { recursive: true, force: true });
  });

  it("collects all files regardless of extension", async () => {
    const files = await collectAllFiles(tempDir);
    expect(files).toHaveLength(2);
  });

  it("returns absolute paths", async () => {
    const files = await collectAllFiles(tempDir);
    for (const f of files) {
      expect(f).toContain(tempDir);
    }
  });
});
