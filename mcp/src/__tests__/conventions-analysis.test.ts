import { describe, it, expect } from "vitest";
import { parseLintOutput, detectDryViolations } from "../tools/conventions-analysis.js";

describe("conventions-analysis", () => {
  it("parseLintOutput returns findings array", async () => {
    const findings = await parseLintOutput(process.cwd());
    expect(Array.isArray(findings)).toBe(true);
  });

  it("detectDryViolations returns findings array", async () => {
    const findings = await detectDryViolations(process.cwd());
    expect(Array.isArray(findings)).toBe(true);
  });
});
