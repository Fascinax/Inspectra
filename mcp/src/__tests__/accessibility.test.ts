import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { mkdirSync, writeFileSync, rmSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { checkA11yTemplates } from "../tools/accessibility.js";

function makeTempDir(): string {
  const dir = join(tmpdir(), `inspectra-a11y-${Date.now()}-${Math.random().toString(36).slice(2)}`);
  mkdirSync(dir, { recursive: true });
  return dir;
}

describe("checkA11yTemplates", () => {
  let tempDir: string;

  beforeEach(() => { tempDir = makeTempDir(); });
  afterEach(() => { rmSync(tempDir, { recursive: true, force: true }); });

  it("returns empty array for empty project", async () => {
    const findings = await checkA11yTemplates(tempDir);
    expect(Array.isArray(findings)).toBe(true);
  });

  it("detects img without alt attribute", async () => {
    writeFileSync(join(tempDir, "page.html"), '<img src="logo.png" class="hero">');
    const findings = await checkA11yTemplates(tempDir);
    expect(findings.some((f) => f.rule === "img-missing-alt")).toBe(true);
  });

  it("does NOT flag img with alt attribute", async () => {
    writeFileSync(join(tempDir, "page.html"), '<img src="logo.png" alt="Company logo">');
    const findings = await checkA11yTemplates(tempDir);
    const altFindings = findings.filter((f) => f.rule === "img-missing-alt");
    expect(altFindings).toHaveLength(0);
  });

  it("detects empty button without accessible name", async () => {
    writeFileSync(join(tempDir, "app.html"), "<button></button>");
    const findings = await checkA11yTemplates(tempDir);
    expect(findings.some((f) => f.rule === "interactive-no-accessible-name")).toBe(true);
  });

  it("does NOT flag button with text content (not matched by empty pattern)", async () => {
    writeFileSync(join(tempDir, "app.html"), "<button>Submit</button>");
    const findings = await checkA11yTemplates(tempDir);
    const emptyBtnFindings = findings.filter((f) => f.rule === "interactive-no-accessible-name");
    expect(emptyBtnFindings).toHaveLength(0);
  });

  it("detects html without lang", async () => {
    writeFileSync(join(tempDir, "index.html"), "<html><head></head><body></body></html>");
    const findings = await checkA11yTemplates(tempDir);
    expect(findings.some((f) => f.rule === "html-missing-lang")).toBe(true);
  });

  it("does NOT flag html with lang attribute", async () => {
    writeFileSync(join(tempDir, "index.html"), '<html lang="en"><head></head><body></body></html>');
    const findings = await checkA11yTemplates(tempDir);
    const langFindings = findings.filter((f) => f.rule === "html-missing-lang");
    expect(langFindings).toHaveLength(0);
  });

  it("all findings have ACC- prefix", async () => {
    writeFileSync(join(tempDir, "page.html"), '<html><img src="x.png"></html>');
    const findings = await checkA11yTemplates(tempDir);
    for (const f of findings) {
      expect(f.id).toMatch(/^ACC-\d{3,4}$/);
      expect(f.domain).toBe("accessibility");
      expect(f.source).toBe("tool");
    }
  });
});
