import { describe, it, expect } from "vitest";
import { registerPrompts } from "../register/prompts.js";

describe("registerPrompts", () => {
  it("is a function", () => {
    expect(typeof registerPrompts).toBe("function");
  });

  it("registers prompts on a mock server", () => {
    const registered: string[] = [];
    const mockServer = {
      registerPrompt: (name: string) => {
        registered.push(name);
      },
    };
    registerPrompts(mockServer as never, "/fake-prompts");
    expect(registered).toContain("audit_full");
    expect(registered).toContain("audit_pr");
  });
});
