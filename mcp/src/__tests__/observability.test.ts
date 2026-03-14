import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { mkdirSync, writeFileSync, rmSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { checkObservability } from "../tools/observability.js";

function makeTempDir(): string {
  const dir = join(tmpdir(), `inspectra-obs-${Date.now()}-${Math.random().toString(36).slice(2)}`);
  mkdirSync(dir, { recursive: true });
  return dir;
}

describe("checkObservability", () => {
  let tempDir: string;

  beforeEach(() => { tempDir = makeTempDir(); });
  afterEach(() => { rmSync(tempDir, { recursive: true, force: true }); });

  it("returns empty array for project with no source files", async () => {
    const findings = await checkObservability(tempDir);
    expect(Array.isArray(findings)).toBe(true);
  });

  it("detects swallowed catch block without logger", async () => {
    writeFileSync(
      join(tempDir, "service.ts"),
      `async function fetchData() {
  try {
    return await db.query('SELECT 1');
  } catch (err) {
    return null;
  }
}`,
    );
    const findings = await checkObservability(tempDir);
    expect(findings.some((f) => f.rule === "swallowed-exception")).toBe(true);
  });

  it("detects swallowed catch block without catch binding", async () => {
    writeFileSync(
      join(tempDir, "controller.ts"),
      `async function loadUser() {
  try {
    return await repo.findOne('123');
  } catch {
    return { error: true };
  }
}`,
    );

    const findings = await checkObservability(tempDir);
    const swallowed = findings.filter((finding) => finding.rule === "swallowed-exception");
    expect(swallowed).toHaveLength(1);
    expect(swallowed[0]?.evidence[0]?.line).toBe(4);
  });

  it("does NOT flag catch block that logs the error", async () => {
    writeFileSync(
      join(tempDir, "service.ts"),
      `async function fetchData() {
  try {
    return await db.query('SELECT 1');
  } catch (err) {
    logger.error(err);
    return null;
  }
}`,
    );
    const findings = await checkObservability(tempDir);
    const swallowed = findings.filter((f) => f.rule === "swallowed-exception");
    expect(swallowed).toHaveLength(0);
  });

  it("does NOT flag catch block that rethrows the error", async () => {
    writeFileSync(
      join(tempDir, "service.ts"),
      `async function fetchData() {
  try {
    return await db.query('SELECT 1');
  } catch {
    throw new Error('query failed');
  }
}`,
    );

    const findings = await checkObservability(tempDir);
    expect(findings.filter((finding) => finding.rule === "swallowed-exception")).toHaveLength(0);
  });

  it("detects missing health endpoint in a file-rich project", async () => {
    for (let i = 0; i < 6; i++) {
      writeFileSync(join(tempDir, `module${i}.ts`), `export const x${i} = ${i};`);
    }
    const findings = await checkObservability(tempDir);
    expect(findings.some((f) => f.rule === "missing-health-endpoint")).toBe(true);
  });

  it("does NOT flag missing health endpoint when one exists", async () => {
    for (let i = 0; i < 6; i++) {
      writeFileSync(join(tempDir, `module${i}.ts`), `export const x${i} = ${i};`);
    }
    writeFileSync(join(tempDir, "index.ts"), `app.get('/health', (_, res) => res.json({ status: 'ok' }));`);
    const findings = await checkObservability(tempDir);
    const healthFindings = findings.filter((f) => f.rule === "missing-health-endpoint");
    expect(healthFindings).toHaveLength(0);
  });

  it("does flag missing health endpoint for plain string references that are not routes", async () => {
    for (let i = 0; i < 6; i++) {
      writeFileSync(join(tempDir, `module${i}.ts`), `export const x${i} = ${i};`);
    }
    writeFileSync(
      join(tempDir, "logger.ts"),
      `export function levelForUrl(url: string) {
  if (url.includes('/health')) return 'debug';
  return 'info';
}`,
    );

    const findings = await checkObservability(tempDir);
    expect(findings.some((finding) => finding.rule === "missing-health-endpoint")).toBe(true);
  });

  it("all findings have OBS- prefix", async () => {
    writeFileSync(
      join(tempDir, "svc.ts"),
      `try { doThing(); } catch (e) { return false; }`,
    );
    const findings = await checkObservability(tempDir);
    for (const f of findings) {
      expect(f.id).toMatch(/^OBS-\d{3,4}$/);
      expect(f.domain).toBe("observability");
      expect(f.source).toBe("tool");
    }
  });

  it("does NOT flag missing health when pom.xml has spring-boot-starter-actuator", async () => {
    for (let i = 0; i < 6; i++) {
      writeFileSync(join(tempDir, `module${i}.ts`), `export const x${i} = ${i};`);
    }
    writeFileSync(
      join(tempDir, "pom.xml"),
      `<project>
  <dependencies>
    <dependency>
      <groupId>org.springframework.boot</groupId>
      <artifactId>spring-boot-starter-actuator</artifactId>
    </dependency>
  </dependencies>
</project>`,
    );
    const findings = await checkObservability(tempDir);
    const healthFindings = findings.filter((f) => f.rule === "missing-health-endpoint");
    expect(healthFindings).toHaveLength(0);
  });

  it("does NOT flag missing health when application.properties has management config", async () => {
    for (let i = 0; i < 6; i++) {
      writeFileSync(join(tempDir, `module${i}.ts`), `export const x${i} = ${i};`);
    }
    const resourceDir = join(tempDir, "src", "main", "resources");
    mkdirSync(resourceDir, { recursive: true });
    writeFileSync(
      join(resourceDir, "application.properties"),
      `management.endpoints.web.exposure.include=health,info\nserver.port=8080\n`,
    );
    const findings = await checkObservability(tempDir);
    const healthFindings = findings.filter((f) => f.rule === "missing-health-endpoint");
    expect(healthFindings).toHaveLength(0);
  });

  it("does NOT flag missing health when application.yml has management config", async () => {
    for (let i = 0; i < 6; i++) {
      writeFileSync(join(tempDir, `module${i}.ts`), `export const x${i} = ${i};`);
    }
    const resourceDir = join(tempDir, "src", "main", "resources");
    mkdirSync(resourceDir, { recursive: true });
    writeFileSync(
      join(resourceDir, "application.yml"),
      `management:
  endpoints:
    web:
      exposure:
        include: health,info
`,
    );
    const findings = await checkObservability(tempDir);
    const healthFindings = findings.filter((f) => f.rule === "missing-health-endpoint");
    expect(healthFindings).toHaveLength(0);
  });
});
