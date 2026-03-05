import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { mkdirSync, writeFileSync, rmSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { loadProjectConfig, resolveConfig } from "../utils/project-config.js";

function makeTempDir(): string {
  const dir = join(tmpdir(), `inspectra-test-${Date.now()}-${Math.random().toString(36).slice(2)}`);
  mkdirSync(dir, { recursive: true });
  return dir;
}

describe("loadProjectConfig", () => {
  let tempDir: string;

  beforeEach(() => {
    tempDir = makeTempDir();
  });

  afterEach(() => {
    rmSync(tempDir, { recursive: true, force: true });
  });

  it("returns empty object when no config file exists", async () => {
    const config = await loadProjectConfig(tempDir);
    expect(config).toEqual({});
  });

  it("loads .inspectrarc.yml when present", async () => {
    writeFileSync(
      join(tempDir, ".inspectrarc.yml"),
      `profile: angular-frontend\ncomplexity_threshold: 15\nignore_dirs:\n  - vendor\n  - generated\n`,
    );

    const config = await loadProjectConfig(tempDir);
    expect(config.profile).toBe("angular-frontend");
    expect(config.complexity_threshold).toBe(15);
    expect(config.ignore_dirs).toEqual(["vendor", "generated"]);
  });

  it("loads .inspectrarc.yaml variant", async () => {
    writeFileSync(
      join(tempDir, ".inspectrarc.yaml"),
      `profile: java-backend\nfile_length_threshold: 500\n`,
    );

    const config = await loadProjectConfig(tempDir);
    expect(config.profile).toBe("java-backend");
    expect(config.file_length_threshold).toBe(500);
  });

  it("loads inspectra.config.yml variant", async () => {
    writeFileSync(
      join(tempDir, "inspectra.config.yml"),
      `exclude_domains:\n  - i18n\n  - accessibility\n`,
    );

    const config = await loadProjectConfig(tempDir);
    expect(config.exclude_domains).toEqual(["i18n", "accessibility"]);
  });

  it("prefers .inspectrarc.yml over .inspectrarc.yaml", async () => {
    writeFileSync(join(tempDir, ".inspectrarc.yml"), `profile: first\n`);
    writeFileSync(join(tempDir, ".inspectrarc.yaml"), `profile: second\n`);

    const config = await loadProjectConfig(tempDir);
    expect(config.profile).toBe("first");
  });

  it("returns empty object for malformed YAML", async () => {
    writeFileSync(join(tempDir, ".inspectrarc.yml"), `:::invalid\n  - [\n`);

    const config = await loadProjectConfig(tempDir);
    expect(config).toEqual({});
  });

  it("returns empty object for YAML array (non-object)", async () => {
    writeFileSync(join(tempDir, ".inspectrarc.yml"), `- item1\n- item2\n`);

    const config = await loadProjectConfig(tempDir);
    expect(config).toEqual({});
  });

  it("returns empty object for YAML scalar (non-object)", async () => {
    writeFileSync(join(tempDir, ".inspectrarc.yml"), `just a string\n`);

    const config = await loadProjectConfig(tempDir);
    expect(config).toEqual({});
  });

  it("loads severity_overrides map", async () => {
    writeFileSync(
      join(tempDir, ".inspectrarc.yml"),
      `severity_overrides:\n  SEC-001: low\n  TST-042: info\n`,
    );

    const config = await loadProjectConfig(tempDir);
    expect(config.severity_overrides).toEqual({ "SEC-001": "low", "TST-042": "info" });
  });
});

describe("resolveConfig", () => {
  it("provides safe defaults for empty config", () => {
    const resolved = resolveConfig({});
    expect(resolved.profile).toBe("generic");
    expect(resolved.complexity_threshold).toBe(10);
    expect(resolved.file_length_threshold).toBe(300);
    expect(resolved.exclude_domains).toEqual([]);
    expect(resolved.severity_overrides).toEqual({});
    expect(resolved.ignore_dirs).toEqual(["node_modules", "dist", "build", ".git", "coverage"]);
  });

  it("preserves provided values", () => {
    const resolved = resolveConfig({
      profile: "java-backend",
      complexity_threshold: 20,
      ignore_dirs: ["vendor"],
    });
    expect(resolved.profile).toBe("java-backend");
    expect(resolved.complexity_threshold).toBe(20);
    expect(resolved.ignore_dirs).toEqual(["vendor"]);
    // Defaults for unset fields
    expect(resolved.file_length_threshold).toBe(300);
    expect(resolved.exclude_domains).toEqual([]);
  });

  it("preserves all fields when fully specified", () => {
    const full = {
      profile: "angular-frontend",
      complexity_threshold: 8,
      file_length_threshold: 250,
      exclude_domains: ["i18n" as const],
      severity_overrides: { "SEC-001": "info" as const },
      ignore_dirs: ["tmp"],
    };
    const resolved = resolveConfig(full);
    expect(resolved).toEqual(full);
  });
});
