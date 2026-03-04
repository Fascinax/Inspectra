import { describe, it, expect } from "vitest";
import { parsePlaywrightReport, detectFlakyTests } from "../tools/tests-e2e.js";

describe("tests-e2e", () => {
  it("parsePlaywrightReport returns empty when no report exists", async () => {
    const findings = await parsePlaywrightReport(process.cwd());
    expect(findings).toEqual([]);
  });

  it("detectFlakyTests returns empty when no reports exist", async () => {
    const findings = await detectFlakyTests(process.cwd());
    expect(findings).toEqual([]);
  });
});
