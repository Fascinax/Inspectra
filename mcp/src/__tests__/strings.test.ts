import { describe, it, expect } from "vitest";
import { capitalize } from "../utils/strings.js";

describe("capitalize", () => {
  it("capitalizes the first character", () => {
    expect(capitalize("hello")).toBe("Hello");
  });

  it("handles single character", () => {
    expect(capitalize("a")).toBe("A");
  });

  it("handles empty string", () => {
    expect(capitalize("")).toBe("");
  });

  it("preserves already capitalized string", () => {
    expect(capitalize("Hello")).toBe("Hello");
  });

  it("preserves rest of the string", () => {
    expect(capitalize("hELLO wORLD")).toBe("HELLO wORLD");
  });
});
