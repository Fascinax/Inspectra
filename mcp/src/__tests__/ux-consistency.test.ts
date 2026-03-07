import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { mkdirSync, writeFileSync, rmSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { checkUxConsistency } from "../tools/ux-consistency.js";

function makeTempDir(): string {
  const dir = join(tmpdir(), `inspectra-ux-${Date.now()}-${Math.random().toString(36).slice(2)}`);
  mkdirSync(dir, { recursive: true });
  return dir;
}

describe("checkUxConsistency", () => {
  let tempDir: string;

  beforeEach(() => { tempDir = makeTempDir(); });
  afterEach(() => { rmSync(tempDir, { recursive: true, force: true }); });

  it("returns empty array for empty project", async () => {
    const findings = await checkUxConsistency(tempDir);
    expect(findings).toEqual([]);
  });

  it("returns empty array for project with no style/template files", async () => {
    writeFileSync(join(tempDir, "index.ts"), "export const x = 1;");
    const findings = await checkUxConsistency(tempDir);
    expect(findings).toEqual([]);
  });

  it("detects hardcoded color values in stylesheets", async () => {
    writeFileSync(
      join(tempDir, "app.css"),
      `.header { color: #ff5733; }
.nav { background: #3498db; }
.footer { border-color: #e74c3c; }
.sidebar { color: #2ecc71; }
.card { background: #9b59b6; }`,
    );
    const findings = await checkUxConsistency(tempDir);
    expect(findings.some((f) => f.rule === "hardcoded-color")).toBe(true);
    const colorFinding = findings.find((f) => f.rule === "hardcoded-color")!;
    expect(colorFinding.domain).toBe("ux-consistency");
    expect(colorFinding.confidence).toBeGreaterThanOrEqual(0.8);
  });

  it("does NOT flag colors in token definition files", async () => {
    writeFileSync(
      join(tempDir, "variables.scss"),
      `$primary: #ff5733;
$secondary: #3498db;
$danger: #e74c3c;
$success: #2ecc71;
$accent: #9b59b6;`,
    );
    const findings = await checkUxConsistency(tempDir);
    const colorFindings = findings.filter((f) => f.rule === "hardcoded-color");
    expect(colorFindings).toHaveLength(0);
  });

  it("does NOT flag common black/white colors", async () => {
    writeFileSync(
      join(tempDir, "base.css"),
      `.text { color: #000; }
.bg { background: #fff; }
.dark { color: #000000; }
.light { background: #ffffff; }`,
    );
    const findings = await checkUxConsistency(tempDir);
    const colorFindings = findings.filter((f) => f.rule === "hardcoded-color");
    expect(colorFindings).toHaveLength(0);
  });

  it("detects inline style proliferation in templates", async () => {
    writeFileSync(
      join(tempDir, "page.html"),
      `<div style="padding: 20px; margin: 10px; color: red">One</div>
<div style="background: blue; border: 1px solid gray; padding: 15px">Two</div>
<div style="font-size: 14px; line-height: 1.5; color: green">Three</div>`,
    );
    const findings = await checkUxConsistency(tempDir);
    expect(findings.some((f) => f.rule === "inline-style-proliferation")).toBe(true);
  });

  it("detects magic z-index values", async () => {
    writeFileSync(
      join(tempDir, "modal.css"),
      `.modal { z-index: 9999; }
.overlay { z-index: 1000; }`,
    );
    const findings = await checkUxConsistency(tempDir);
    expect(findings.some((f) => f.rule === "magic-zindex")).toBe(true);
  });

  it("does NOT flag reasonable z-index values", async () => {
    writeFileSync(
      join(tempDir, "layout.css"),
      `.dropdown { z-index: 10; }
.tooltip { z-index: 20; }`,
    );
    const findings = await checkUxConsistency(tempDir);
    const zFindings = findings.filter((f) => f.rule === "magic-zindex");
    expect(zFindings).toHaveLength(0);
  });

  it("detects missing prefers-reduced-motion when animations exist", async () => {
    writeFileSync(
      join(tempDir, "animations.css"),
      `@keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } }
.fade { animation: fadeIn 300ms ease; }`,
    );
    const findings = await checkUxConsistency(tempDir);
    expect(findings.some((f) => f.rule === "missing-reduced-motion")).toBe(true);
  });

  it("does NOT flag when prefers-reduced-motion is present", async () => {
    writeFileSync(
      join(tempDir, "animations.css"),
      `@keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } }
.fade { animation: fadeIn 300ms ease; }
@media (prefers-reduced-motion: reduce) {
  *, *::before, *::after { animation-duration: 0.01ms !important; }
}`,
    );
    const findings = await checkUxConsistency(tempDir);
    const motionFindings = findings.filter((f) => f.rule === "missing-reduced-motion");
    expect(motionFindings).toHaveLength(0);
  });

  it("detects font family proliferation", async () => {
    writeFileSync(
      join(tempDir, "styles.css"),
      `.header { font-family: "Inter", sans-serif; }
.body { font-family: "Roboto", sans-serif; }
.code { font-family: "Fira Code", monospace; }
.sidebar { font-family: "Montserrat", sans-serif; }`,
    );
    const findings = await checkUxConsistency(tempDir);
    expect(findings.some((f) => f.rule === "font-family-proliferation")).toBe(true);
  });

  it("all findings have UX- prefix and correct domain", async () => {
    writeFileSync(
      join(tempDir, "app.css"),
      `.a { color: #ff5733; }
.b { color: #3498db; }
.c { color: #e74c3c; }
.d { color: #2ecc71; }
.e { color: #9b59b6; }
.modal { z-index: 9999; }`,
    );
    writeFileSync(
      join(tempDir, "page.html"),
      `<div style="padding: 20px; margin: 10px; color: red; font-size: 14px">A</div>
<div style="background: blue; border: 1px solid gray; padding: 15px">B</div>
<div style="font-size: 14px; line-height: 1.5; color: green; display: flex">C</div>`,
    );
    const findings = await checkUxConsistency(tempDir);
    expect(findings.length).toBeGreaterThan(0);
    for (const f of findings) {
      expect(f.id).toMatch(/^UX-\d{3,4}$/);
      expect(f.domain).toBe("ux-consistency");
      expect(f.source).toBe("tool");
      expect(f.confidence).toBeGreaterThanOrEqual(0.8);
    }
  });

  it("detects shadow sprawl with many unique box-shadow values", async () => {
    writeFileSync(
      join(tempDir, "components.css"),
      `.card { box-shadow: 0 1px 3px rgba(0,0,0,0.12); }
.dropdown { box-shadow: 0 2px 8px rgba(0,0,0,0.15); }
.modal { box-shadow: 0 4px 16px rgba(0,0,0,0.2); }
.tooltip { box-shadow: 0 0 4px rgba(0,0,0,0.1); }
.popover { box-shadow: 0 8px 24px rgba(0,0,0,0.25); }
.header { box-shadow: 0 1px 0 rgba(0,0,0,0.05); }`,
    );
    const findings = await checkUxConsistency(tempDir);
    expect(findings.some((f) => f.rule === "shadow-sprawl")).toBe(true);
  });
});
