import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { mkdirSync, writeFileSync, rmSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { checkTestQuality } from "../tools/tests-quality.js";

function makeTempDir(): string {
  const dir = join(tmpdir(), `inspectra-test-${Date.now()}-${Math.random().toString(36).slice(2)}`);
  mkdirSync(dir, { recursive: true });
  return dir;
}

describe("checkTestQuality", () => {
  let tempDir: string;

  beforeEach(() => {
    tempDir = makeTempDir();
  });

  afterEach(() => {
    rmSync(tempDir, { recursive: true, force: true });
  });

  it("detects test files with no assertions", async () => {
    writeFileSync(
      join(tempDir, "empty.test.ts"),
      `
        it("should work", () => {
          const result = add(1, 2);
          // Nothing checked!
        });
      `,
    );

    const findings = await checkTestQuality(tempDir);
    expect(findings.length).toBe(1);
    expect(findings[0].rule).toBe("empty-assertion");
    expect(findings[0].severity).toBe("medium");
  });

  it("ignores test files with assertions", async () => {
    writeFileSync(
      join(tempDir, "valid.test.ts"),
      `
        it("should work", () => {
          const result = add(1, 2);
          expect(result).toBe(3);
        });
      `,
    );

    const findings = await checkTestQuality(tempDir);
    expect(findings.length).toBe(0);
  });

  it("detects excessive mocking without assertions", async () => {
    writeFileSync(
      join(tempDir, "overmocked.test.ts"),
      `
        jest.mock('./api');
        jest.mock('./db');
        jest.mock('./cache');
        jest.mock('./logger');
        jest.mock('./metrics');
        
        it("should work", () => {
          const result = doSomething();
        });
      `,
    );

    const findings = await checkTestQuality(tempDir);
    expect(findings.length).toBe(2); // empty-assertion + excessive-mocking
    expect(findings.some((f) => f.rule === "excessive-mocking")).toBe(true);
  });

  it("ignores skipped tests when checking assertions", async () => {
    writeFileSync(
      join(tempDir, "skipped.test.ts"),
      `
        it.skip("should work", () => {
          const result = add(1, 2);
        });
      `,
    );

    const findings = await checkTestQuality(tempDir);
    expect(findings.length).toBe(0);
  });

  it("supports Java JUnit test files", async () => {
    writeFileSync(
      join(tempDir, "EmptyTest.java"),
      `
        public class EmptyTest {
          @Test
          public void testSomething() {
            String result = service.doWork();
          }
        }
      `,
    );

    const findings = await checkTestQuality(tempDir);
    expect(findings.length).toBe(1);
    expect(findings[0].rule).toBe("empty-assertion");
  });

  it("accepts Java tests with assertions", async () => {
    writeFileSync(
      join(tempDir, "ValidTest.java"),
      `
        public class ValidTest {
          @Test
          public void testSomething() {
            String result = service.doWork();
            assertEquals("expected", result);
          }
        }
      `,
    );

    const findings = await checkTestQuality(tempDir);
    expect(findings.length).toBe(0);
  });

  it("skips non-test files", async () => {
    writeFileSync(join(tempDir, "helper.ts"), "export function help() {}");
    const findings = await checkTestQuality(tempDir);
    expect(findings.length).toBe(0);
  });
});
