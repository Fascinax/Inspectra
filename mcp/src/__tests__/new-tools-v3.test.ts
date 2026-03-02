import { describe, it, expect } from "vitest";
import { mkdtemp, mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";

import { checkReadmeCompleteness, checkAdrPresence } from "../tools/documentation.js";
import { analyzeComplexity, ageTodos } from "../tools/tech-debt.js";

describe("v0.3 tools", () => {
  it("flags missing readme", async () => {
    const dir = await mkdtemp(join(tmpdir(), "inspectra-v3-"));
    const findings = await checkReadmeCompleteness(dir);
    expect(findings.length).toBeGreaterThan(0);
    expect(findings[0].domain).toBe("documentation");
  });

  it("flags missing adr", async () => {
    const dir = await mkdtemp(join(tmpdir(), "inspectra-v3-"));
    await writeFile(join(dir, "README.md"), "# Project\n", "utf-8");
    const findings = await checkAdrPresence(dir);
    expect(findings.length).toBe(1);
    expect(findings[0].rule).toBe("adr-missing");
  });

  it("detects high complexity file", async () => {
    const dir = await mkdtemp(join(tmpdir(), "inspectra-v3-"));
    await mkdir(join(dir, "src"));
    await writeFile(
      join(dir, "src", "complex.ts"),
      Array.from({ length: 45 }, () => "if (a && b || c) { doThing(); }").join("\n"),
      "utf-8",
    );

    const findings = await analyzeComplexity(dir);
    expect(findings.length).toBeGreaterThan(0);
    expect(findings[0].domain).toBe("tech-debt");
  });

  it("detects aged todos", async () => {
    const dir = await mkdtemp(join(tmpdir(), "inspectra-v3-"));
    await mkdir(join(dir, "src"));
    await writeFile(join(dir, "src", "todo.ts"), "// TODO 2024-01-01: cleanup", "utf-8");

    const findings = await ageTodos(dir);
    expect(findings.length).toBeGreaterThan(0);
    expect(findings[0].rule).toBe("aged-todo");
  });
});
