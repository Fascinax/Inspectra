import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { mkdirSync, writeFileSync, rmSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import {
  checkDeadExports,
  detectDeprecatedApis,
  detectCodeSmells,
} from "../tools/tech-debt-smells.js";

function makeTempDir(): string {
  const dir = join(tmpdir(), `inspectra-debt-smells-${Date.now()}-${Math.random().toString(36).slice(2)}`);
  mkdirSync(dir, { recursive: true });
  return dir;
}

/* ================================================================== */
/*  checkDeadExports                                                   */
/* ================================================================== */

describe("checkDeadExports", () => {
  let tempDir: string;

  beforeEach(() => {
    tempDir = makeTempDir();
  });

  afterEach(() => {
    rmSync(tempDir, { recursive: true, force: true });
  });

  it("returns empty when no source files exist", async () => {
    const findings = await checkDeadExports(tempDir);
    expect(findings).toEqual([]);
  });

  it("returns empty when all exports are imported", async () => {
    writeFileSync(join(tempDir, "utils.ts"), "export function helper() { return 1; }\n");
    writeFileSync(join(tempDir, "main.ts"), 'import { helper } from "./utils";\nconsole.log(helper());\n');

    const findings = await checkDeadExports(tempDir);
    // 'main' is not imported by anyone, but 'helper' IS imported
    const helperFindings = findings.filter((f) => f.title.includes("helper"));
    expect(helperFindings).toEqual([]);
  });

  it("detects exported symbols with zero imports", async () => {
    writeFileSync(join(tempDir, "orphan.ts"), "export function neverUsed() { return 42; }\n");
    writeFileSync(join(tempDir, "other.ts"), "const x = 1;\n");

    const findings = await checkDeadExports(tempDir);
    const orphanFindings = findings.filter((f) => f.title.includes("neverUsed"));
    expect(orphanFindings.length).toBeGreaterThanOrEqual(1);
    expect(orphanFindings[0].rule).toBe("dead-export");
    expect(orphanFindings[0].domain).toBe("tech-debt");
    expect(orphanFindings[0].source).toBe("tool");
  });

  it("assigns DEBT-3xx IDs to findings", async () => {
    writeFileSync(join(tempDir, "lonely.ts"), "export class Unused {}\n");
    writeFileSync(join(tempDir, "app.ts"), "const x = 1;\n");

    const findings = await checkDeadExports(tempDir);
    const deadFindings = findings.filter((f) => f.title.includes("Unused"));
    expect(deadFindings.length).toBeGreaterThanOrEqual(1);
    expect(deadFindings[0].id).toMatch(/^DEBT-3\d{2}$/);
  });

  it("skips test infrastructure directories", async () => {
    const testDir = join(tempDir, "__tests__");
    mkdirSync(testDir, { recursive: true });
    writeFileSync(join(testDir, "fixture.ts"), "export function testHelper() {}\n");
    writeFileSync(join(tempDir, "app.ts"), "const x = 1;\n");

    const findings = await checkDeadExports(tempDir);
    const testFindings = findings.filter((f) => f.title.includes("testHelper"));
    expect(testFindings).toEqual([]);
  });
});

/* ================================================================== */
/*  detectDeprecatedApis                                               */
/* ================================================================== */

describe("detectDeprecatedApis", () => {
  let tempDir: string;

  beforeEach(() => {
    tempDir = makeTempDir();
  });

  afterEach(() => {
    rmSync(tempDir, { recursive: true, force: true });
  });

  it("returns empty when no source files exist", async () => {
    const findings = await detectDeprecatedApis(tempDir);
    expect(findings).toEqual([]);
  });

  it("returns empty when no deprecated APIs are used", async () => {
    writeFileSync(join(tempDir, "clean.ts"), "const root = createRoot(document.getElementById('root'));\nroot.render(<App />);\n");

    const findings = await detectDeprecatedApis(tempDir);
    expect(findings).toEqual([]);
  });

  it("detects deprecated React APIs", async () => {
    const code = [
      "class MyComponent extends React.Component {",
      "  componentWillMount() {",
      "    this.setState({ loaded: true });",
      "  }",
      "}",
    ].join("\n");
    writeFileSync(join(tempDir, "legacy.ts"), code);

    const findings = await detectDeprecatedApis(tempDir);
    expect(findings.length).toBeGreaterThanOrEqual(1);
    expect(findings[0].rule).toBe("deprecated-api-usage");
    expect(findings[0].title).toContain("componentWillMount");
    expect(findings[0].domain).toBe("tech-debt");
  });

  it("detects deprecated Node.js Buffer constructor", async () => {
    writeFileSync(join(tempDir, "server.ts"), "const buf = new Buffer(10);\n");

    const findings = await detectDeprecatedApis(tempDir);
    expect(findings.length).toBeGreaterThanOrEqual(1);
    expect(findings[0].title).toContain("new Buffer()");
  });

  it("detects deprecated Spring Boot APIs in Java files", async () => {
    const code = [
      "public class SecurityConfig extends WebSecurityConfigurerAdapter {",
      "  @Override",
      "  protected void configure(HttpSecurity http) {}",
      "}",
    ].join("\n");
    writeFileSync(join(tempDir, "SecurityConfig.java"), code);

    const findings = await detectDeprecatedApis(tempDir);
    expect(findings.length).toBeGreaterThanOrEqual(1);
    expect(findings[0].title).toContain("WebSecurityConfigurerAdapter");
    expect(findings[0].severity).toBe("high");
  });

  it("assigns DEBT-35x IDs to findings", async () => {
    writeFileSync(join(tempDir, "old.ts"), "const buf = new Buffer(10);\n");

    const findings = await detectDeprecatedApis(tempDir);
    expect(findings.length).toBeGreaterThanOrEqual(1);
    expect(findings[0].id).toMatch(/^DEBT-35\d$/);
  });

  it("skips import lines", async () => {
    writeFileSync(join(tempDir, "imports-only.ts"), 'import { ComponentFactoryResolver } from "@angular/core";\n');

    const findings = await detectDeprecatedApis(tempDir);
    expect(findings).toEqual([]);
  });
});

/* ================================================================== */
/*  detectCodeSmells                                                   */
/* ================================================================== */

describe("detectCodeSmells", () => {
  let tempDir: string;

  beforeEach(() => {
    tempDir = makeTempDir();
  });

  afterEach(() => {
    rmSync(tempDir, { recursive: true, force: true });
  });

  it("returns empty when no source files exist", async () => {
    const findings = await detectCodeSmells(tempDir);
    expect(findings).toEqual([]);
  });

  it("returns empty for small well-structured classes", async () => {
    const code = [
      "export class UserService {",
      "  getUser(id: string) { return id; }",
      "  saveUser(user: any) { return user; }",
      "}",
    ].join("\n");
    writeFileSync(join(tempDir, "user.ts"), code);

    const findings = await detectCodeSmells(tempDir);
    expect(findings).toEqual([]);
  });

  it("detects God classes with too many methods", async () => {
    const methods: string[] = [];
    for (let i = 0; i < 12; i++) {
      methods.push(`  method${i}() { return ${i}; }`);
    }
    const code = `export class GodService {\n${methods.join("\n")}\n}`;
    writeFileSync(join(tempDir, "god.ts"), code);

    const findings = await detectCodeSmells(tempDir);
    const godFindings = findings.filter((f) => f.rule === "god-class");
    expect(godFindings.length).toBeGreaterThanOrEqual(1);
    expect(godFindings[0].title).toContain("GodService");
    expect(godFindings[0].title).toContain("12 methods");
    expect(godFindings[0].domain).toBe("tech-debt");
  });

  it("detects deeply nested code", async () => {
    const code = [
      "function deep() {",
      "  if (a) {",
      "    if (b) {",
      "      if (c) {",
      "        if (d) {",
      "          if (e) {",
      "            console.log('too deep');",
      "          }",
      "        }",
      "      }",
      "    }",
      "  }",
      "}",
    ].join("\n");
    writeFileSync(join(tempDir, "nested.ts"), code);

    const findings = await detectCodeSmells(tempDir);
    const nestFindings = findings.filter((f) => f.rule === "deep-nesting");
    expect(nestFindings.length).toBeGreaterThanOrEqual(1);
    expect(nestFindings[0].title).toContain("Deep nesting");
  });

  it("assigns DEBT-4xx IDs to findings", async () => {
    const methods: string[] = [];
    for (let i = 0; i < 12; i++) {
      methods.push(`  method${i}() { return ${i}; }`);
    }
    const code = `export class Big {\n${methods.join("\n")}\n}`;
    writeFileSync(join(tempDir, "big.ts"), code);

    const findings = await detectCodeSmells(tempDir);
    expect(findings.length).toBeGreaterThanOrEqual(1);
    expect(findings[0].id).toMatch(/^DEBT-4\d{2}$/);
  });

  it("skips test infrastructure directories", async () => {
    const testDir = join(tempDir, "__tests__");
    mkdirSync(testDir, { recursive: true });

    const methods: string[] = [];
    for (let i = 0; i < 12; i++) {
      methods.push(`  method${i}() { return ${i}; }`);
    }
    writeFileSync(join(testDir, "fixture.ts"), `class TestFixture {\n${methods.join("\n")}\n}`);

    const findings = await detectCodeSmells(tempDir);
    expect(findings).toEqual([]);
  });

  it("includes JPA mutating query findings through the aggregate entry point", async () => {
    const repositoryDir = join(tempDir, "src", "main", "java", "com", "app", "repository");
    mkdirSync(repositoryDir, { recursive: true });
    writeFileSync(
      join(repositoryDir, "UserRepository.java"),
      `package com.app.repository;

import org.springframework.data.jpa.repository.Query;

public interface UserRepository {
    @Query(
        value = """
            UPDATE User u
            SET u.active = false
            WHERE u.loginAttempts > 5
            """
    )
    void deactivateInactiveUsers();
  }`,
    );

    const findings = await detectCodeSmells(tempDir);
    expect(findings.some((finding) => finding.rule === "jpa-missing-modifying")).toBe(true);
  });
});
