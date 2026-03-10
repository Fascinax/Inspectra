import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { mkdirSync, writeFileSync, rmSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { analyzeModuleDependencies, detectCircularDependencies } from "../tools/architecture-deps.js";

function makeTempDir(): string {
  const dir = join(tmpdir(), `inspectra-deps-${Date.now()}-${Math.random().toString(36).slice(2)}`);
  mkdirSync(dir, { recursive: true });
  return dir;
}

describe("architecture-deps", () => {
  it("analyzeModuleDependencies returns findings array", async () => {
    const findings = await analyzeModuleDependencies(process.cwd());
    expect(Array.isArray(findings)).toBe(true);
  });

  it("detectCircularDependencies returns findings array", async () => {
    const findings = await detectCircularDependencies(process.cwd());
    expect(Array.isArray(findings)).toBe(true);
  });
});

describe("detectCircularDependencies — Java support", () => {
  let tempDir: string;

  beforeEach(() => { tempDir = makeTempDir(); });
  afterEach(() => { rmSync(tempDir, { recursive: true, force: true }); });

  it("detects circular dependency between Java files via package imports", async () => {
    const serviceDir = join(tempDir, "com", "app", "service");
    const repoDir = join(tempDir, "com", "app", "repository");
    mkdirSync(serviceDir, { recursive: true });
    mkdirSync(repoDir, { recursive: true });

    writeFileSync(
      join(serviceDir, "UserService.java"),
      `package com.app.service;
import com.app.repository.UserRepo;
public class UserService {}
`,
    );
    writeFileSync(
      join(repoDir, "UserRepo.java"),
      `package com.app.repository;
import com.app.service.UserService;
public class UserRepo {}
`,
    );

    const findings = await detectCircularDependencies(tempDir);
    expect(findings.some((f) => f.rule === "no-circular-dependency")).toBe(true);
  });

  it("does NOT flag Java files with no circular imports", async () => {
    const serviceDir = join(tempDir, "com", "app", "service");
    const modelDir = join(tempDir, "com", "app", "model");
    mkdirSync(serviceDir, { recursive: true });
    mkdirSync(modelDir, { recursive: true });

    writeFileSync(
      join(serviceDir, "UserService.java"),
      `package com.app.service;
import com.app.model.User;
public class UserService {}
`,
    );
    writeFileSync(
      join(modelDir, "User.java"),
      `package com.app.model;
public class User {}
`,
    );

    const findings = await detectCircularDependencies(tempDir);
    expect(findings.filter((f) => f.rule === "no-circular-dependency")).toHaveLength(0);
  });
});
