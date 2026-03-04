import { describe, it, expect } from "vitest";
import { checkFileLengths, checkTodoFixmes } from "../tools/conventions-files.js";

describe("conventions-files", () => {
  it("checkFileLengths returns findings array", async () => {
    const findings = await checkFileLengths(process.cwd());
    expect(Array.isArray(findings)).toBe(true);
  });

  it("checkTodoFixmes returns findings array", async () => {
    const findings = await checkTodoFixmes(process.cwd());
    expect(Array.isArray(findings)).toBe(true);
  });
});
