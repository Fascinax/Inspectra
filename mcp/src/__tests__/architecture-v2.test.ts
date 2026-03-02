import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { mkdirSync, writeFileSync, rmSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { detectCircularDependencies } from "../tools/architecture.js";

function makeTempDir(): string {
  const dir = join(tmpdir(), `inspectra-arc-v2-${Date.now()}-${Math.random().toString(36).slice(2)}`);
  mkdirSync(dir, { recursive: true });
  return dir;
}

describe("detectCircularDependencies", () => {
  let tempDir: string;

  beforeEach(() => { tempDir = makeTempDir(); });
  afterEach(() => { rmSync(tempDir, { recursive: true, force: true }); });

  it("returns empty array for a project with no source files", async () => {
    const findings = await detectCircularDependencies(tempDir);
    expect(findings).toHaveLength(0);
  });

  it("returns empty array when no circular dependencies exist", async () => {
    // a.ts → b.ts → c.ts (linear chain)
    writeFileSync(join(tempDir, "a.ts"), `import { b } from "./b";\nexport const a = 1;`);
    writeFileSync(join(tempDir, "b.ts"), `import { c } from "./c";\nexport const b = 2;`);
    writeFileSync(join(tempDir, "c.ts"), `export const c = 3;`);

    const findings = await detectCircularDependencies(tempDir);
    expect(findings).toHaveLength(0);
  });

  it("detects a simple A → B → A circular dependency", async () => {
    writeFileSync(join(tempDir, "a.ts"), `import { b } from "./b";\nexport const a = 1;`);
    writeFileSync(join(tempDir, "b.ts"), `import { a } from "./a";\nexport const b = 2;`);

    const findings = await detectCircularDependencies(tempDir);
    expect(findings.length).toBeGreaterThanOrEqual(1);
    const circular = findings.find((f) => f.rule === "no-circular-dependency");
    expect(circular).toBeDefined();
    expect(circular?.severity).toBe("high");
    expect(circular?.domain).toBe("architecture");
  });

  it("detects a three-node cycle A → B → C → A", async () => {
    writeFileSync(join(tempDir, "a.ts"), `import { b } from "./b";\nexport const a = 1;`);
    writeFileSync(join(tempDir, "b.ts"), `import { c } from "./c";\nexport const b = 2;`);
    writeFileSync(join(tempDir, "c.ts"), `import { a } from "./a";\nexport const c = 3;`);

    const findings = await detectCircularDependencies(tempDir);
    expect(findings.length).toBeGreaterThanOrEqual(1);
    expect(findings[0].rule).toBe("no-circular-dependency");
    expect(findings[0].tags).toContain("circular-dependency");
  });

  it("does not flag unrelated files alongside a cycle", async () => {
    // clean island: d.ts and e.ts — no cycle
    writeFileSync(join(tempDir, "d.ts"), `import { e } from "./e";\nexport const d = 4;`);
    writeFileSync(join(tempDir, "e.ts"), `export const e = 5;`);
    // cyclic pair
    writeFileSync(join(tempDir, "x.ts"), `import { y } from "./y";\nexport const x = 1;`);
    writeFileSync(join(tempDir, "y.ts"), `import { x } from "./x";\nexport const y = 2;`);

    const findings = await detectCircularDependencies(tempDir);
    expect(findings.length).toBeGreaterThanOrEqual(1);
    // All findings should be about x or y, not d or e
    for (const f of findings) {
      const files = f.evidence.map((e) => e.file);
      const involvesDOrE = files.some((file) => file.includes("d.ts") || file.includes("e.ts"));
      expect(involvesDOrE).toBe(false);
    }
  });

  it("deduplicates the same cycle", async () => {
    writeFileSync(join(tempDir, "p.ts"), `import { q } from "./q";\nexport const p = 1;`);
    writeFileSync(join(tempDir, "q.ts"), `import { p } from "./p";\nexport const q = 2;`);

    const findings = await detectCircularDependencies(tempDir);
    // Should report the cycle only once, not twice (from each entry point)
    expect(findings.length).toBe(1);
  });

  it("produces findings with valid structure", async () => {
    writeFileSync(join(tempDir, "alpha.ts"), `import { beta } from "./beta";\nexport const alpha = 1;`);
    writeFileSync(join(tempDir, "beta.ts"), `import { alpha } from "./alpha";\nexport const beta = 2;`);

    const findings = await detectCircularDependencies(tempDir);
    for (const f of findings) {
      expect(f.id).toMatch(/^ARC-\d{3}$/);
      expect(f.domain).toBe("architecture");
      expect(f.evidence.length).toBeGreaterThan(0);
      expect(typeof f.confidence).toBe("number");
    }
  });
});
