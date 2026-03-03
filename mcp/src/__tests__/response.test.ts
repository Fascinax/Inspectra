import { describe, it, expect } from "vitest";
import { jsonResponse } from "../register/response.js";
import { makeFinding } from "./fixtures.js";
import { CHARACTER_LIMIT } from "../constants.js";

describe("jsonResponse", () => {
  it("returns structuredContent alongside text content", () => {
    const data = [makeFinding()];
    const result = jsonResponse(data);

    expect(result.content).toHaveLength(1);
    expect(result.content[0].type).toBe("text");
    expect(result.structuredContent).toEqual(data);
  });

  it("returns valid JSON when data fits within CHARACTER_LIMIT", () => {
    const findings = [makeFinding(), makeFinding({ id: "SEC-002" })];
    const result = jsonResponse(findings);

    const text = (result.content[0] as { type: "text"; text: string }).text;
    expect(() => JSON.parse(text)).not.toThrow();
    expect(JSON.parse(text)).toEqual(findings);
  });

  it("truncates large arrays while producing valid JSON", () => {
    const largeFindings = Array.from({ length: 5000 }, (_, i) =>
      makeFinding({
        id: `SEC-${String(i).padStart(4, "0")}`,
        description: "A".repeat(200),
      }),
    );

    const result = jsonResponse(largeFindings);
    const text = (result.content[0] as { type: "text"; text: string }).text;

    expect(() => JSON.parse(text)).not.toThrow();
    expect(text.length).toBeLessThanOrEqual(CHARACTER_LIMIT);

    const parsed = JSON.parse(text) as Record<string, unknown>;
    expect(parsed.truncated).toBe(true);
    expect(parsed.total_count).toBe(5000);
    expect(typeof parsed.returned_count).toBe("number");
    expect((parsed.returned_count as number)).toBeLessThan(5000);
    expect(typeof parsed.truncation_message).toBe("string");
    expect(Array.isArray(parsed.findings)).toBe(true);
  });

  it("truncates object with findings array while preserving other fields", () => {
    const report = {
      domain: "security",
      score: 42,
      findings: Array.from({ length: 5000 }, (_, i) =>
        makeFinding({
          id: `SEC-${String(i).padStart(4, "0")}`,
          description: "B".repeat(200),
        }),
      ),
    };

    const result = jsonResponse(report);
    const text = (result.content[0] as { type: "text"; text: string }).text;
    const parsed = JSON.parse(text) as Record<string, unknown>;

    expect(parsed.domain).toBe("security");
    expect(parsed.score).toBe(42);
    expect(parsed.truncated).toBe(true);
    expect((parsed.findings as unknown[]).length).toBeLessThan(5000);
  });

  it("returns error metadata when non-array data exceeds limit", () => {
    const huge = { payload: "X".repeat(CHARACTER_LIMIT + 1000) };
    const result = jsonResponse(huge);
    const text = (result.content[0] as { type: "text"; text: string }).text;
    const parsed = JSON.parse(text) as Record<string, unknown>;

    expect(parsed.error).toBe("Response too large to serialize");
    expect(parsed.character_limit).toBe(CHARACTER_LIMIT);
  });
});
