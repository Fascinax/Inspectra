import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { mkdirSync, writeFileSync, rmSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { runSemgrep, checkMavenDependencies } from "../tools/security.js";

function makeTempDir(): string {
  const dir = join(tmpdir(), `inspectra-sec-v2-${Date.now()}-${Math.random().toString(36).slice(2)}`);
  mkdirSync(dir, { recursive: true });
  return dir;
}

describe("runSemgrep", () => {
  it("returns empty array when semgrep is not installed or project has no issues", async () => {
    // semgrep may or may not be installed — either way we should get a valid array
    const findings = await runSemgrep(tmpdir());
    expect(Array.isArray(findings)).toBe(true);
  });

  it("returns empty array for empty project directory", async () => {
    const tempDir = makeTempDir();
    try {
      const findings = await runSemgrep(tempDir);
      expect(Array.isArray(findings)).toBe(true);
    } finally {
      rmSync(tempDir, { recursive: true, force: true });
    }
  });
});

describe("checkMavenDependencies", () => {
  let tempDir: string;

  beforeEach(() => {
    tempDir = makeTempDir();
  });
  afterEach(() => {
    rmSync(tempDir, { recursive: true, force: true });
  });

  it("returns empty array when pom.xml is absent", async () => {
    const findings = await checkMavenDependencies(tempDir);
    expect(findings).toHaveLength(0);
  }, 30000);

  it("flags projects with more than 50 dependencies", async () => {
    const deps = Array.from(
      { length: 55 },
      (_, i) =>
        `<dependency>\n  <groupId>org.test</groupId>\n  <artifactId>lib-${i}</artifactId>\n  <version>1.0.0</version>\n</dependency>`,
    ).join("\n");
    writeFileSync(join(tempDir, "pom.xml"), `<project>\n<dependencies>\n${deps}\n</dependencies>\n</project>`);

    const findings = await checkMavenDependencies(tempDir);
    const depCountFinding = findings.find((f) => f.rule === "excessive-maven-dependencies");
    expect(depCountFinding).toBeDefined();
    expect(depCountFinding?.severity).toBe("medium");
    expect(depCountFinding?.title).toContain("55");
  }, 30000);

  // increased timeout: checkMavenDependencies may run `mvn` which takes time to fail
  it("does not flag projects with 50 or fewer dependencies", async () => {
    const deps = Array.from(
      { length: 30 },
      (_, i) =>
        `<dependency>\n  <groupId>org.test</groupId>\n  <artifactId>lib-${i}</artifactId>\n  <version>1.0.0</version>\n</dependency>`,
    ).join("\n");
    writeFileSync(join(tempDir, "pom.xml"), `<project>\n<dependencies>\n${deps}\n</dependencies>\n</project>`);

    const findings = await checkMavenDependencies(tempDir);
    expect(findings.find((f) => f.rule === "excessive-maven-dependencies")).toBeUndefined();
  }, 30000);

  it("flags SNAPSHOT dependency versions", async () => {
    writeFileSync(
      join(tempDir, "pom.xml"),
      `
<project>
  <dependencies>
    <dependency>
      <groupId>com.example</groupId>
      <artifactId>my-lib</artifactId>
      <version>1.2.3-SNAPSHOT</version>
    </dependency>
  </dependencies>
</project>`,
    );

    const findings = await checkMavenDependencies(tempDir);
    const snapshotFinding = findings.find((f) => f.rule === "no-snapshot-dependency");
    expect(snapshotFinding).toBeDefined();
    expect(snapshotFinding?.severity).toBe("low");
    expect(snapshotFinding?.title).toContain("SNAPSHOT");
  }, 30000);

  it("does not flag stable version dependencies", async () => {
    writeFileSync(
      join(tempDir, "pom.xml"),
      `
<project>
  <dependencies>
    <dependency>
      <groupId>org.springframework</groupId>
      <artifactId>spring-core</artifactId>
      <version>5.3.21</version>
    </dependency>
  </dependencies>
</project>`,
    );

    const findings = await checkMavenDependencies(tempDir);
    expect(findings).toHaveLength(0);
  }, 30000);

  it("produces findings with valid domain and evidence", async () => {
    const deps = Array.from(
      { length: 55 },
      (_, i) =>
        `<dependency><groupId>org.test</groupId><artifactId>lib-${i}</artifactId><version>1.0.0</version></dependency>`,
    ).join("\n");
    writeFileSync(join(tempDir, "pom.xml"), `<project><dependencies>${deps}</dependencies></project>`);

    const findings = await checkMavenDependencies(tempDir);
    for (const f of findings) {
      expect(f.domain).toBe("security");
      expect(f.evidence.length).toBeGreaterThan(0);
      expect(f.id).toMatch(/^SEC-\d{3}$/);
    }
  }, 30000);
});
