import { describe, it, expect } from "vitest";
import {
  ResponseFormatField,
  LimitField,
  OffsetField,
  ProjectDirField,
  ProfileField,
  FindingsOutputSchema,
  ScoreOutputSchema,
  READ_ONLY_ANNOTATIONS,
  READ_ONLY_OPEN_WORLD_ANNOTATIONS,
} from "../register/schemas.js";

describe("ResponseFormatField", () => {
  it("accepts json", () => {
    expect(ResponseFormatField.parse("json")).toBe("json");
  });

  it("accepts markdown", () => {
    expect(ResponseFormatField.parse("markdown")).toBe("markdown");
  });

  it("defaults to json", () => {
    expect(ResponseFormatField.parse(undefined)).toBe("json");
  });

  it("rejects invalid format", () => {
    expect(() => ResponseFormatField.parse("xml")).toThrow();
  });
});

describe("LimitField", () => {
  it("accepts positive integers", () => {
    expect(LimitField.parse(10)).toBe(10);
  });

  it("rejects zero", () => {
    expect(() => LimitField.parse(0)).toThrow();
  });

  it("rejects negative numbers", () => {
    expect(() => LimitField.parse(-1)).toThrow();
  });
});

describe("OffsetField", () => {
  it("accepts zero", () => {
    expect(OffsetField.parse(0)).toBe(0);
  });

  it("accepts positive integers", () => {
    expect(OffsetField.parse(5)).toBe(5);
  });

  it("rejects negative numbers", () => {
    expect(() => OffsetField.parse(-1)).toThrow();
  });
});

describe("ProjectDirField", () => {
  it("accepts non-empty strings", () => {
    expect(ProjectDirField.parse("/app")).toBe("/app");
  });

  it("rejects empty string", () => {
    expect(() => ProjectDirField.parse("")).toThrow();
  });
});

describe("ProfileField", () => {
  it("accepts valid profile name", () => {
    expect(ProfileField.parse("generic")).toBe("generic");
  });

  it("accepts undefined (optional)", () => {
    expect(ProfileField.parse(undefined)).toBeUndefined();
  });
});

describe("FindingsOutputSchema", () => {
  it("has required keys", () => {
    expect(FindingsOutputSchema).toHaveProperty("findings");
    expect(FindingsOutputSchema).toHaveProperty("total");
    expect(FindingsOutputSchema).toHaveProperty("count");
    expect(FindingsOutputSchema).toHaveProperty("has_more");
    expect(FindingsOutputSchema).toHaveProperty("next_offset");
  });
});

describe("ScoreOutputSchema", () => {
  it("has a score field", () => {
    expect(ScoreOutputSchema).toHaveProperty("score");
  });
});

describe("READ_ONLY_ANNOTATIONS", () => {
  it("marks tools as read-only and idempotent", () => {
    expect(READ_ONLY_ANNOTATIONS.readOnlyHint).toBe(true);
    expect(READ_ONLY_ANNOTATIONS.destructiveHint).toBe(false);
    expect(READ_ONLY_ANNOTATIONS.idempotentHint).toBe(true);
    expect(READ_ONLY_ANNOTATIONS.openWorldHint).toBe(false);
  });
});

describe("READ_ONLY_OPEN_WORLD_ANNOTATIONS", () => {
  it("marks tools as read-only with open world", () => {
    expect(READ_ONLY_OPEN_WORLD_ANNOTATIONS.readOnlyHint).toBe(true);
    expect(READ_ONLY_OPEN_WORLD_ANNOTATIONS.openWorldHint).toBe(true);
  });
});
