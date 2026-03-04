import { describe, it, expect } from "vitest";
import { createIdSequence } from "../utils/id.js";

describe("createIdSequence", () => {
  it("generates sequential IDs with the given prefix", () => {
    const nextId = createIdSequence("SEC");
    expect(nextId()).toBe("SEC-001");
    expect(nextId()).toBe("SEC-002");
    expect(nextId()).toBe("SEC-003");
  });

  it("pads numbers to 3 digits", () => {
    const nextId = createIdSequence("TST");
    expect(nextId()).toMatch(/^TST-\d{3}$/);
  });

  it("supports custom start value", () => {
    const nextId = createIdSequence("ARC", 100);
    expect(nextId()).toBe("ARC-100");
    expect(nextId()).toBe("ARC-101");
  });

  it("each sequence is independent", () => {
    const a = createIdSequence("A");
    const b = createIdSequence("B");
    expect(a()).toBe("A-001");
    expect(b()).toBe("B-001");
    expect(a()).toBe("A-002");
  });
});
