import { describe, it, expect } from "vitest";
import { registerMergerTools } from "../register/merger.js";

describe("registerMergerTools", () => {
  it("is a function", () => {
    expect(typeof registerMergerTools).toBe("function");
  });

  it("registers expected tools on a mock server", () => {
    const registered: string[] = [];
    const mockServer = {
      registerTool: (name: string) => {
        registered.push(name);
      },
    };
    registerMergerTools(mockServer as never, "/fake-policies");
    expect(registered).toContain("inspectra_merge_domain_reports");
    expect(registered).toContain("inspectra_score_findings");
    expect(registered).toContain("inspectra_correlate_findings");
    expect(registered).toContain("inspectra_infer_root_causes");
  });
});
