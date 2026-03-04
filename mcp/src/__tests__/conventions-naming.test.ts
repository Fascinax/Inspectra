import { describe, it, expect } from "vitest";
import { checkNamingConventions } from "../tools/conventions-naming.js";

describe("conventions-naming", () => {
  it("returns findings array for the workspace", async () => {
    const findings = await checkNamingConventions(process.cwd());
    expect(Array.isArray(findings)).toBe(true);
  });
});
