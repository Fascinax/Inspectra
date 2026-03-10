import { describe, it, expect } from "vitest";
import { MAX_SNIPPET_LENGTH, SUPPORTED_EXTENSIONS, TEST_INFRA_PATH } from "../utils/shared-constants.js";

describe("shared-constants", () => {
  describe("MAX_SNIPPET_LENGTH", () => {
    it("equals 120", () => {
      expect(MAX_SNIPPET_LENGTH).toBe(120);
    });
  });

  describe("SUPPORTED_EXTENSIONS", () => {
    it("contains expected source extensions", () => {
      for (const ext of [".ts", ".js", ".java", ".py", ".go", ".kt"]) {
        expect(SUPPORTED_EXTENSIONS.has(ext)).toBe(true);
      }
    });

    it("does not contain non-source extensions", () => {
      for (const ext of [".md", ".json", ".yml", ".html", ".css"]) {
        expect(SUPPORTED_EXTENSIONS.has(ext)).toBe(false);
      }
    });
  });

  describe("TEST_INFRA_PATH", () => {
    it("matches __tests__ directory", () => {
      expect(TEST_INFRA_PATH.test("src/__tests__/foo.ts")).toBe(true);
    });

    it("matches test__ directory", () => {
      expect(TEST_INFRA_PATH.test("src/test__/foo.ts")).toBe(true);
    });

    it("matches tests directory", () => {
      expect(TEST_INFRA_PATH.test("src/tests/foo.ts")).toBe(true);
    });

    it("matches fixtures directory", () => {
      expect(TEST_INFRA_PATH.test("src/fixtures/data.json")).toBe(true);
    });

    it("matches __mocks__ directory", () => {
      expect(TEST_INFRA_PATH.test("src/__mocks__/api.ts")).toBe(true);
    });

    it("matches e2e directory", () => {
      expect(TEST_INFRA_PATH.test("e2e/login.spec.ts")).toBe(true);
    });

    it("matches spec directory", () => {
      expect(TEST_INFRA_PATH.test("spec/unit/foo.ts")).toBe(true);
    });

    it("does not match regular source directories", () => {
      expect(TEST_INFRA_PATH.test("src/services/user.ts")).toBe(false);
      expect(TEST_INFRA_PATH.test("src/utils/helper.ts")).toBe(false);
    });

    it("does not match partial names like contest or spectacle", () => {
      expect(TEST_INFRA_PATH.test("src/contest/winner.ts")).toBe(false);
      expect(TEST_INFRA_PATH.test("src/spectacle/show.ts")).toBe(false);
    });
  });
});
