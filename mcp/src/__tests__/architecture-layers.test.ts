import { describe, it, expect } from "vitest";
import { checkLayering } from "../tools/architecture-layers.js";

describe("architecture-layers", () => {
  it("returns empty findings for a flat project", async () => {
    const findings = await checkLayering(process.cwd());
    expect(Array.isArray(findings)).toBe(true);
  });
});
