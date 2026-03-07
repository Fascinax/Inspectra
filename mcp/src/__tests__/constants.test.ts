import { describe, it, expect } from "vitest";
import { CHARACTER_LIMIT, SERVER_NAME, DEFAULT_PROFILE, DEFAULT_PAGE_SIZE } from "../constants.js";

describe("constants", () => {
  it("CHARACTER_LIMIT defaults to 10_000", () => {
    expect(CHARACTER_LIMIT).toBe(10_000);
  });

  it("SERVER_NAME is inspectra", () => {
    expect(SERVER_NAME).toBe("inspectra");
  });

  it("DEFAULT_PROFILE is generic", () => {
    expect(DEFAULT_PROFILE).toBe("generic");
  });

  it("DEFAULT_PAGE_SIZE defaults to 20", () => {
    expect(DEFAULT_PAGE_SIZE).toBe(20);
  });

  it("all constants are truthy", () => {
    expect(CHARACTER_LIMIT).toBeGreaterThan(0);
    expect(SERVER_NAME).toBeTruthy();
    expect(DEFAULT_PROFILE).toBeTruthy();
    expect(DEFAULT_PAGE_SIZE).toBeGreaterThan(0);
  });
});
