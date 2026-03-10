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

  it("detects excessive assertions per test method in Java", async () => {
    const assertions = Array.from({ length: 60 }, (_, i) =>
      `        .andExpect(jsonPath("$.field${i}").value("val${i}"))`
    ).join("\n");
    writeFileSync(
      join(tempDir, "BrittleTest.java"),
      `public class BrittleTest {
    @Test
    public void testGetCable() throws Exception {
        mockMvc.perform(get("/cables/1"))
            .andExpect(status().isOk())
${assertions};
    }
    @Test
    public void testGetCable2() throws Exception {
        mockMvc.perform(get("/cables/2"))
            .andExpect(status().isOk())
${assertions};
    }
}`,
    );
    const findings = await checkTestQuality(tempDir);
    const brittle = findings.filter((f) => f.rule === "excessive-assertions");
    expect(brittle).toHaveLength(1);
    expect(brittle[0]!.severity).toBe("medium");
  });

  it("does not flag Java tests with reasonable assertion count", async () => {
    writeFileSync(
      join(tempDir, "ReasonableTest.java"),
      `public class ReasonableTest {
    @Test
    public void testCreate() {
        assertEquals("expected", result);
        assertNotNull(entity);
        assertTrue(entity.isActive());
    }
    @Test
    public void testUpdate() {
        assertEquals("updated", result);
    }
}`,
    );
    const findings = await checkTestQuality(tempDir);
    expect(findings.filter((f) => f.rule === "excessive-assertions")).toHaveLength(0);
  });

  it("detects @SpringBootTest without slicing", async () => {
    writeFileSync(
      join(tempDir, "HeavyTest.java"),
      `@SpringBootTest
public class HeavyTest {
    @Test
    public void testController() {
        assertEquals("ok", result);
    }
}`,
    );
    const findings = await checkTestQuality(tempDir);
    const slicing = findings.filter((f) => f.rule === "missing-test-slicing");
    expect(slicing).toHaveLength(1);
    expect(slicing[0]!.severity).toBe("low");
  });

  it("does not flag @WebMvcTest", async () => {
    writeFileSync(
      join(tempDir, "SlicedTest.java"),
      `@WebMvcTest(UserController.class)
public class SlicedTest {
    @Test
    public void testController() {
        assertEquals("ok", result);
    }
}`,
    );
    const findings = await checkTestQuality(tempDir);
    expect(findings.filter((f) => f.rule === "missing-test-slicing")).toHaveLength(0);
  });

  it("does not flag @DataJpaTest", async () => {
    writeFileSync(
      join(tempDir, "RepoTest.java"),
      `@DataJpaTest
@SpringBootTest
public class RepoTest {
    @Test
    public void testRepo() {
        assertNotNull(repo.findById(1L));
    }
}`,
    );
    const findings = await checkTestQuality(tempDir);
    expect(findings.filter((f) => f.rule === "missing-test-slicing")).toHaveLength(0);
  });
});
