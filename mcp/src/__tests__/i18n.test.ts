import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { mkdirSync, writeFileSync, rmSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { checkI18n } from "../tools/i18n.js";

function makeTempDir(): string {
  const dir = join(tmpdir(), `inspectra-i18n-${Date.now()}-${Math.random().toString(36).slice(2)}`);
  mkdirSync(dir, { recursive: true });
  return dir;
}

describe("checkI18n", () => {
  let tempDir: string;

  beforeEach(() => { tempDir = makeTempDir(); });
  afterEach(() => { rmSync(tempDir, { recursive: true, force: true }); });

  it("returns empty array for project with no source files", async () => {
    const findings = await checkI18n(tempDir);
    expect(Array.isArray(findings)).toBe(true);
  });

  it("detects missing i18n library in a project with multiple source files", async () => {
    for (let i = 0; i < 6; i++) {
      writeFileSync(join(tempDir, `module${i}.ts`), `export const x${i} = ${i};`);
    }
    const findings = await checkI18n(tempDir);
    expect(findings.some((f) => f.rule === "missing-i18n-library")).toBe(true);
  });

  it("does NOT flag missing i18n library when ngx-translate is used", async () => {
    writeFileSync(
      join(tempDir, "app.module.ts"),
      `import { TranslateModule } from '@ngx-translate/core';`,
    );
    for (let i = 0; i < 5; i++) {
      writeFileSync(join(tempDir, `module${i}.ts`), `export const x${i} = ${i};`);
    }
    const findings = await checkI18n(tempDir);
    const libFindings = findings.filter((f) => f.rule === "missing-i18n-library");
    expect(libFindings).toHaveLength(0);
  });

  it("detects hardcoded strings in templates when i18n is adopted", async () => {
    // Set up a project with i18n library in one file
    writeFileSync(join(tempDir, "app.ts"), `import { TranslateModule } from '@ngx-translate/core';`);
    for (let i = 0; i < 4; i++) {
      writeFileSync(join(tempDir, `svc${i}.ts`), `export const x = ${i};`);
    }
    // Template with hardcoded strings (no translate pipe)
    writeFileSync(
      join(tempDir, "home.html"),
      `<div>
  <h1>Welcome to our application</h1>
  <p>Please log in to continue</p>
  <button>Sign In</button>
  <a href="#">Forgot your password</a>
</div>`,
    );
    const findings = await checkI18n(tempDir);
    expect(findings.some((f) => f.rule === "hardcoded-template-string")).toBe(true);
  });

  it("all findings have INT- prefix", async () => {
    for (let i = 0; i < 6; i++) {
      writeFileSync(join(tempDir, `module${i}.ts`), `export const label = "Hello World ${i}";`);
    }
    const findings = await checkI18n(tempDir);
    for (const f of findings) {
      expect(f.id).toMatch(/^INT-\d{3,4}$/);
      expect(f.domain).toBe("i18n");
      expect(f.source).toBe("tool");
    }
  });
});
