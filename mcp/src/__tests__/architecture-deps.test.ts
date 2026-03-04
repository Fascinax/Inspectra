import { describe, it, expect } from "vitest";
import { analyzeModuleDependencies, detectCircularDependencies } from "../tools/architecture-deps.js";

describe("architecture-deps", () => {
  it("analyzeModuleDependencies returns findings array", async () => {
    const findings = await analyzeModuleDependencies(process.cwd());
    expect(Array.isArray(findings)).toBe(true);
  });

  it("detectCircularDependencies returns findings array", async () => {
    const findings = await detectCircularDependencies(process.cwd());
    expect(Array.isArray(findings)).toBe(true);
  });
});
