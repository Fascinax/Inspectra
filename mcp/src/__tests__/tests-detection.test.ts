import { describe, it, expect } from "vitest";
import { detectMissingTests } from "../tools/tests-detection.js";

describe("tests-detection", () => {
  it("detectMissingTests returns findings array", async () => {
    const findings = await detectMissingTests(process.cwd());
    expect(Array.isArray(findings)).toBe(true);
  });
});
