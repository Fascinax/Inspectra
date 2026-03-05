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
});
