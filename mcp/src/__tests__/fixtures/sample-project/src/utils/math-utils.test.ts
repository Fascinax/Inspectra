import { describe, it, expect } from "vitest";
import { add, sub, mul, div } from "../utils/math-utils.js";

describe("math-utils", () => {
  it("adds two numbers", () => expect(add(1, 2)).toBe(3));
  it("subtracts two numbers", () => expect(sub(5, 3)).toBe(2));
  it("multiplies two numbers", () => expect(mul(2, 4)).toBe(8));
  it("divides two numbers", () => expect(div(10, 2)).toBe(5));
});
