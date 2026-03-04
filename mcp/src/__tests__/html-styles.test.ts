import { describe, it, expect } from "vitest";
import { renderStyles } from "../renderer/html-styles.js";

describe("renderStyles", () => {
  it("returns a <style> block with CSS variables", () => {
    const css = renderStyles();
    expect(css).toContain("<style>");
    expect(css).toContain("</style>");
    expect(css).toContain("--bg-primary");
    expect(css).toContain("--accent");
  });

  it("includes responsive media query", () => {
    const css = renderStyles();
    expect(css).toContain("@media");
    expect(css).toContain("max-width");
  });
});
