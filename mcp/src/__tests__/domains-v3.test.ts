import { describe, it, expect } from "vitest";
import { DOMAINS } from "../types.js";
import { DEFAULT_SCORING } from "../policies/scoring.js";

describe("v0.3 domains", () => {
  it("includes new domains in type registry", () => {
    expect(DOMAINS).toContain("performance");
    expect(DOMAINS).toContain("documentation");
    expect(DOMAINS).toContain("tech-debt");
  });

  it("includes weights for the new domains", () => {
    expect(DEFAULT_SCORING.domain_weights["performance"]).toBeGreaterThan(0);
    expect(DEFAULT_SCORING.domain_weights["documentation"]).toBeGreaterThan(0);
    expect(DEFAULT_SCORING.domain_weights["tech-debt"]).toBeGreaterThan(0);
  });
});
