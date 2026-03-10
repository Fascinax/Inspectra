import { describe, it, expect } from "vitest";
import { FindingBuilder, finding } from "../utils/finding-builder.js";
import { createIdSequence } from "../utils/id.js";

function makeId() {
  return createIdSequence("TEST");
}

describe("FindingBuilder", () => {
  it("builds a complete finding with all required fields", () => {
    const nextId = makeId();
    const result = new FindingBuilder(nextId)
      .severity("high")
      .title("Test finding")
      .domain("security")
      .rule("test-rule")
      .confidence(0.9)
      .file("src/app.ts", 10, "const secret = 'abc'")
      .build();

    expect(result).toMatchObject({
      id: "TEST-001",
      severity: "high",
      title: "Test finding",
      domain: "security",
      rule: "test-rule",
      confidence: 0.9,
      source: "tool",
      evidence: [{ file: "src/app.ts", line: 10, snippet: "const secret = 'abc'" }],
    });
  });

  it("sets optional fields when provided", () => {
    const nextId = makeId();
    const result = new FindingBuilder(nextId)
      .severity("medium")
      .title("Optional fields")
      .description("A description")
      .domain("conventions")
      .rule("opt-rule")
      .confidence(0.85)
      .file("src/foo.ts")
      .recommendation("Fix it")
      .effort("small")
      .tags(["clean-code", "naming"])
      .source("llm")
      .build();

    expect(result.description).toBe("A description");
    expect(result.recommendation).toBe("Fix it");
    expect(result.effort).toBe("small");
    expect(result.tags).toEqual(["clean-code", "naming"]);
    expect(result.source).toBe("llm");
  });

  it("omits optional fields when not set", () => {
    const nextId = makeId();
    const result = new FindingBuilder(nextId)
      .severity("low")
      .title("Minimal")
      .domain("tests")
      .rule("min-rule")
      .confidence(0.8)
      .file("src/x.ts")
      .build();

    expect(result).not.toHaveProperty("description");
    expect(result).not.toHaveProperty("recommendation");
    expect(result).not.toHaveProperty("effort");
    expect(result).not.toHaveProperty("tags");
  });

  it("defaults source to tool", () => {
    const nextId = makeId();
    const result = new FindingBuilder(nextId)
      .severity("info")
      .title("Default source")
      .domain("security")
      .rule("src-rule")
      .confidence(0.9)
      .file("a.ts")
      .build();

    expect(result.source).toBe("tool");
  });

  it("increments IDs across multiple builds", () => {
    const nextId = makeId();
    const base = () =>
      new FindingBuilder(nextId)
        .severity("low")
        .title("t")
        .domain("security")
        .rule("r")
        .confidence(0.8)
        .file("a.ts");

    expect(base().build().id).toBe("TEST-001");
    expect(base().build().id).toBe("TEST-002");
    expect(base().build().id).toBe("TEST-003");
  });

  it("accumulates multiple evidence entries", () => {
    const nextId = makeId();
    const result = new FindingBuilder(nextId)
      .severity("high")
      .title("Multi evidence")
      .domain("architecture")
      .rule("multi")
      .confidence(0.9)
      .file("a.ts", 1, "line 1")
      .file("b.ts", 2, "line 2")
      .file("c.ts")
      .build();

    expect(result.evidence).toHaveLength(3);
    expect(result.evidence[0]).toEqual({ file: "a.ts", line: 1, snippet: "line 1" });
    expect(result.evidence[1]).toEqual({ file: "b.ts", line: 2, snippet: "line 2" });
    expect(result.evidence[2]).toEqual({ file: "c.ts" });
  });

  it("truncates long snippets to 120 characters", () => {
    const nextId = makeId();
    const longSnippet = "x".repeat(200);
    const result = new FindingBuilder(nextId)
      .severity("low")
      .title("Long snippet")
      .domain("conventions")
      .rule("trunc")
      .confidence(0.8)
      .file("a.ts", 1, longSnippet)
      .build();

    expect(result.evidence[0].snippet).toHaveLength(120);
  });

  it("evidence omits line and snippet when not provided", () => {
    const nextId = makeId();
    const result = new FindingBuilder(nextId)
      .severity("low")
      .title("No line")
      .domain("security")
      .rule("r")
      .confidence(0.8)
      .file("a.ts")
      .build();

    expect(result.evidence[0]).toEqual({ file: "a.ts" });
    expect(result.evidence[0]).not.toHaveProperty("line");
    expect(result.evidence[0]).not.toHaveProperty("snippet");
  });

  // ─── Validation ──────────────────────────────────────────────────────

  it("throws when severity is missing", () => {
    const nextId = makeId();
    expect(() =>
      new FindingBuilder(nextId)
        .title("t")
        .domain("security")
        .rule("r")
        .confidence(0.8)
        .file("a.ts")
        .build(),
    ).toThrow("severity is required");
  });

  it("throws when title is missing", () => {
    const nextId = makeId();
    expect(() =>
      new FindingBuilder(nextId)
        .severity("low")
        .domain("security")
        .rule("r")
        .confidence(0.8)
        .file("a.ts")
        .build(),
    ).toThrow("title is required");
  });

  it("throws when domain is missing", () => {
    const nextId = makeId();
    expect(() =>
      new FindingBuilder(nextId)
        .severity("low")
        .title("t")
        .rule("r")
        .confidence(0.8)
        .file("a.ts")
        .build(),
    ).toThrow("domain is required");
  });

  it("throws when rule is missing", () => {
    const nextId = makeId();
    expect(() =>
      new FindingBuilder(nextId)
        .severity("low")
        .title("t")
        .domain("security")
        .confidence(0.8)
        .file("a.ts")
        .build(),
    ).toThrow("rule is required");
  });

  it("throws when confidence is missing", () => {
    const nextId = makeId();
    expect(() =>
      new FindingBuilder(nextId)
        .severity("low")
        .title("t")
        .domain("security")
        .rule("r")
        .file("a.ts")
        .build(),
    ).toThrow("confidence is required");
  });

  it("throws when evidence is empty", () => {
    const nextId = makeId();
    expect(() =>
      new FindingBuilder(nextId)
        .severity("low")
        .title("t")
        .domain("security")
        .rule("r")
        .confidence(0.8)
        .build(),
    ).toThrow("at least one evidence is required");
  });
});

describe("finding() factory", () => {
  it("returns a FindingBuilder instance", () => {
    const nextId = makeId();
    const builder = finding(nextId);
    expect(builder).toBeInstanceOf(FindingBuilder);
  });

  it("builds a valid finding via factory", () => {
    const nextId = makeId();
    const result = finding(nextId)
      .severity("critical")
      .title("Factory test")
      .domain("security")
      .rule("factory")
      .confidence(0.95)
      .file("main.ts", 42)
      .build();

    expect(result.id).toBe("TEST-001");
    expect(result.severity).toBe("critical");
  });
});
