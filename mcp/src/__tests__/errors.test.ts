import { describe, it, expect } from "vitest";
import {
  InspectraError,
  InvalidPathError,
  ProfileNotFoundError,
  ParseError,
  ValidationError,
  FileNotFoundError,
} from "../errors.js";
import { errorResponse, withErrorHandling } from "../register/response.js";
import type { CallToolResult } from "@modelcontextprotocol/sdk/types.js";

// ─── Error hierarchy ─────────────────────────────────────────────────────────

describe("InspectraError hierarchy", () => {
  it("InvalidPathError carries code and default suggestion", () => {
    const err = new InvalidPathError('Path does not exist: "/foo"');
    expect(err).toBeInstanceOf(InspectraError);
    expect(err).toBeInstanceOf(Error);
    expect(err.code).toBe("INVALID_PATH");
    expect(err.suggestion).toContain("absolute directory");
    expect(err.message).toContain("/foo");
  });

  it("InvalidPathError accepts custom suggestion", () => {
    const err = new InvalidPathError("bad path", "Try /home/user/project instead.");
    expect(err.suggestion).toBe("Try /home/user/project instead.");
  });

  it("ProfileNotFoundError formats message from profile name", () => {
    const err = new ProfileNotFoundError("nonexistent");
    expect(err.code).toBe("PROFILE_NOT_FOUND");
    expect(err.message).toBe('Profile not found: "nonexistent"');
    expect(err.suggestion).toContain("policies/profiles/");
  });

  it("ParseError carries code PARSE_ERROR", () => {
    const err = new ParseError("Unexpected token at position 0");
    expect(err.code).toBe("PARSE_ERROR");
    expect(err.suggestion).toContain("valid JSON");
  });

  it("ValidationError carries code VALIDATION_ERROR", () => {
    const err = new ValidationError("Missing required field: severity");
    expect(err.code).toBe("VALIDATION_ERROR");
    expect(err.suggestion).toContain("inputSchema");
  });

  it("FileNotFoundError formats message from file path", () => {
    const err = new FileNotFoundError("/app/coverage/lcov.info");
    expect(err.code).toBe("FILE_NOT_FOUND");
    expect(err.message).toContain("lcov.info");
    expect(err.suggestion).toContain("exists");
  });
});

// ─── errorResponse enrichment ────────────────────────────────────────────────

describe("errorResponse with actionable errors", () => {
  function parseErrorPayload(result: CallToolResult): Record<string, string> {
    const text = (result.content[0] as { type: "text"; text: string }).text;
    return JSON.parse(text) as Record<string, string>;
  }

  it("includes code and suggestion for InspectraError", () => {
    const err = new InvalidPathError('Path not found: "/x"');
    const result = errorResponse(err);

    expect(result.isError).toBe(true);
    const payload = parseErrorPayload(result);
    expect(payload.error).toContain("/x");
    expect(payload.code).toBe("INVALID_PATH");
    expect(payload.suggestion).toBeTruthy();
  });

  it("includes tool_name when provided", () => {
    const err = new ParseError("bad json");
    const result = errorResponse(err, "inspectra_merge_domain_reports");
    const payload = parseErrorPayload(result);
    expect(payload.tool_name).toBe("inspectra_merge_domain_reports");
  });

  it("provides fallback suggestion for generic Error", () => {
    const result = errorResponse(new Error("something broke"));
    const payload = parseErrorPayload(result);
    expect(payload.suggestion).toContain("unexpected error");
    expect(payload.code).toBeUndefined();
  });

  it("provides fallback suggestion for non-Error values", () => {
    const result = errorResponse("string error");
    const payload = parseErrorPayload(result);
    expect(payload.error).toBe("string error");
    expect(payload.suggestion).toBeTruthy();
  });
});

// ─── withErrorHandling toolName propagation ──────────────────────────────────

describe("withErrorHandling with toolName", () => {
  it("propagates toolName into error response", async () => {
    const failing = withErrorHandling(async () => {
      throw new InvalidPathError("no such dir");
    }, "inspectra_check_naming");

    const result = await failing({});
    expect(result.isError).toBe(true);
    const text = (result.content[0] as { type: "text"; text: string }).text;
    const payload = JSON.parse(text) as Record<string, string>;
    expect(payload.tool_name).toBe("inspectra_check_naming");
    expect(payload.code).toBe("INVALID_PATH");
    expect(payload.suggestion).toBeTruthy();
  });

  it("does not include tool_name when omitted", async () => {
    const failing = withErrorHandling(async () => {
      throw new Error("generic");
    });

    const result = await failing({});
    const text = (result.content[0] as { type: "text"; text: string }).text;
    const payload = JSON.parse(text) as Record<string, string>;
    expect(payload.tool_name).toBeUndefined();
  });
});
