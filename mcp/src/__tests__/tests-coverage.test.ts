import { describe, it, expect } from "vitest";
import { parseCoverage, parseTestResults } from "../tools/tests-coverage.js";

describe("tests-coverage", () => {
  it("parseCoverage returns empty when no coverage report exists", async () => {
    const findings = await parseCoverage(process.cwd());
    expect(findings).toEqual([]);
  });

  it("parseTestResults returns empty when no junit XML exists", async () => {
    const findings = await parseTestResults(process.cwd());
    expect(findings).toEqual([]);
  });
});
