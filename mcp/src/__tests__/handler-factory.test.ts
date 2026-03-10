import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { mkdirSync, rmSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import type { Finding } from "../types.js";
import { createStandardHandler, createConfigHandler } from "../register/handler-factory.js";

function makeTempDir(): string {
  const dir = join(tmpdir(), `inspectra-test-${Date.now()}-${Math.random().toString(36).slice(2)}`);
  mkdirSync(dir, { recursive: true });
  return dir;
}

const STUB_FINDING: Finding = {
  id: "TEST-001",
  severity: "low",
  title: "stub",
  domain: "security",
  rule: "stub-rule",
  confidence: 0.9,
  evidence: [{ file: "a.ts" }],
  source: "tool",
};

describe("handler-factory", () => {
  let tempDir: string;

  beforeEach(() => {
    tempDir = makeTempDir();
  });
  afterEach(() => {
    rmSync(tempDir, { recursive: true, force: true });
  });

  describe("createStandardHandler", () => {
    it("calls the tool function and returns findings response", async () => {
      const toolFn = async () => [STUB_FINDING];
      const handler = createStandardHandler("test_tool", toolFn);
      const result = await handler({ projectDir: tempDir });

      expect(result.isError).toBeUndefined();
      const content = result.content[0];
      expect(content.type).toBe("text");
      const parsed = JSON.parse((content as { type: "text"; text: string }).text);
      expect(parsed.findings).toHaveLength(1);
      expect(parsed.findings[0].id).toBe("TEST-001");
    });

    it("returns error for invalid projectDir", async () => {
      const toolFn = async () => [];
      const handler = createStandardHandler("test_tool", toolFn);
      const result = await handler({ projectDir: "/nonexistent/path/that/does/not/exist" });

      expect(result.isError).toBe(true);
    });

    it("supports pagination params", async () => {
      const findings = Array.from({ length: 5 }, (_, i) => ({
        ...STUB_FINDING,
        id: `TEST-${String(i + 1).padStart(3, "0")}`,
      }));
      const toolFn = async () => findings;
      const handler = createStandardHandler("test_tool", toolFn);
      const result = await handler({ projectDir: tempDir, limit: 2, offset: 0 });

      const parsed = JSON.parse((result.content[0] as { type: "text"; text: string }).text);
      expect(parsed.findings).toHaveLength(2);
      expect(parsed.total).toBe(5);
      expect(parsed.has_more).toBe(true);
    });
  });

  describe("createConfigHandler", () => {
    it("calls the tool function with projectDir and ignoreDirs", async () => {
      let receivedIgnoreDirs: string[] | undefined;
      const toolFn = async (_dir: string, ignoreDirs?: string[]) => {
        receivedIgnoreDirs = ignoreDirs;
        return [STUB_FINDING];
      };
      const handler = createConfigHandler("test_tool", toolFn);
      const result = await handler({ projectDir: tempDir });

      expect(result.isError).toBeUndefined();
      expect(receivedIgnoreDirs).toBeDefined();
      expect(Array.isArray(receivedIgnoreDirs)).toBe(true);
    });

    it("returns error for invalid projectDir", async () => {
      const toolFn = async () => [];
      const handler = createConfigHandler("test_tool", toolFn);
      const result = await handler({ projectDir: "/nonexistent/path/that/does/not/exist" });

      expect(result.isError).toBe(true);
    });
  });
});
