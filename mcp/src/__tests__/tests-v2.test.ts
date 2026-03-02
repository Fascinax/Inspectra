import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { mkdirSync, writeFileSync, rmSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { parsePlaywrightReport, detectFlakyTests } from "../tools/tests.js";

function makeTempDir(): string {
  const dir = join(tmpdir(), `inspectra-tests-v2-${Date.now()}-${Math.random().toString(36).slice(2)}`);
  mkdirSync(dir, { recursive: true });
  return dir;
}

describe("parsePlaywrightReport", () => {
  let tempDir: string;

  beforeEach(() => {
    tempDir = makeTempDir();
  });
  afterEach(() => {
    rmSync(tempDir, { recursive: true, force: true });
  });

  it("returns empty array when no report file exists", async () => {
    const findings = await parsePlaywrightReport(tempDir);
    expect(findings).toHaveLength(0);
  });

  it("detects failed tests from playwright-report/results.json", async () => {
    mkdirSync(join(tempDir, "playwright-report"), { recursive: true });
    const report = {
      suites: [
        {
          title: "auth.spec.ts",
          suites: [],
          tests: [
            {
              title: "should login successfully",
              results: [{ status: "failed", duration: 1200, error: { message: "Expected 200 but got 401" } }],
            },
          ],
        },
      ],
    };
    writeFileSync(join(tempDir, "playwright-report", "results.json"), JSON.stringify(report));

    const findings = await parsePlaywrightReport(tempDir);
    expect(findings).toHaveLength(1);
    expect(findings[0].rule).toBe("playwright-test-failure");
    expect(findings[0].severity).toBe("high");
    expect(findings[0].title).toContain("should login successfully");
  });

  it("detects timed-out tests", async () => {
    mkdirSync(join(tempDir, "playwright-report"), { recursive: true });
    const report = {
      suites: [
        {
          title: "e2e.spec.ts",
          tests: [
            {
              title: "checkout flow",
              results: [{ status: "timedOut", duration: 30000 }],
            },
          ],
        },
      ],
    };
    writeFileSync(join(tempDir, "playwright-report", "results.json"), JSON.stringify(report));

    const findings = await parsePlaywrightReport(tempDir);
    expect(findings).toHaveLength(1);
    expect(findings[0].title).toContain("checkout flow");
  });

  it("ignores passing tests", async () => {
    mkdirSync(join(tempDir, "playwright-report"), { recursive: true });
    const report = {
      suites: [
        {
          title: "home.spec.ts",
          tests: [
            { title: "renders homepage", results: [{ status: "passed", duration: 300 }] },
            { title: "shows footer", results: [{ status: "passed", duration: 120 }] },
          ],
        },
      ],
    };
    writeFileSync(join(tempDir, "playwright-report", "results.json"), JSON.stringify(report));

    const findings = await parsePlaywrightReport(tempDir);
    expect(findings).toHaveLength(0);
  });

  it("handles nested suites", async () => {
    mkdirSync(join(tempDir, "playwright-report"), { recursive: true });
    const report = {
      suites: [
        {
          title: "outer.spec.ts",
          suites: [
            {
              title: "Inner Suite",
              tests: [
                {
                  title: "nested test fails",
                  results: [{ status: "failed", duration: 500, error: { message: "boom" } }],
                },
              ],
            },
          ],
          tests: [],
        },
      ],
    };
    writeFileSync(join(tempDir, "playwright-report", "results.json"), JSON.stringify(report));

    const findings = await parsePlaywrightReport(tempDir);
    expect(findings).toHaveLength(1);
    expect(findings[0].title).toContain("nested test fails");
  });

  it("falls back to test-results.json if playwright-report/results.json does not exist", async () => {
    const report = {
      suites: [
        {
          title: "api.spec.ts",
          tests: [
            {
              title: "POST /users returns 201",
              results: [{ status: "failed", duration: 800, error: { message: "assertion failed" } }],
            },
          ],
        },
      ],
    };
    writeFileSync(join(tempDir, "test-results.json"), JSON.stringify(report));

    const findings = await parsePlaywrightReport(tempDir);
    expect(findings).toHaveLength(1);
  });
});

describe("detectFlakyTests", () => {
  let tempDir: string;

  beforeEach(() => {
    tempDir = makeTempDir();
  });
  afterEach(() => {
    rmSync(tempDir, { recursive: true, force: true });
  });

  it("returns empty array when no test-results exist", async () => {
    const findings = await detectFlakyTests(tempDir);
    expect(findings).toHaveLength(0);
  });

  it("detects flaky tests via JUnit rerunFailure", async () => {
    mkdirSync(join(tempDir, "test-results"), { recursive: true });
    const xml = `<?xml version="1.0" encoding="UTF-8"?>
<testsuite name="com.example.OrderServiceTest">
  <testcase name="createOrder_shouldPersist" classname="com.example.OrderServiceTest" time="0.8">
    <rerunFailure message="Connection timeout" type="java.net.SocketTimeoutException">
      at com.example.OrderServiceTest.createOrder_shouldPersist(OrderServiceTest.java:42)
    </rerunFailure>
  </testcase>
</testsuite>`;
    writeFileSync(join(tempDir, "test-results", "junit.xml"), xml);

    const findings = await detectFlakyTests(tempDir);
    expect(findings.length).toBeGreaterThanOrEqual(1);
    const flaky = findings.find((f) => f.rule === "flaky-test");
    expect(flaky).toBeDefined();
    expect(flaky?.severity).toBe("medium");
    expect(flaky?.title).toContain("createOrder_shouldPersist");
  });

  it("detects flaky Playwright tests (failed then passed on retry)", async () => {
    mkdirSync(join(tempDir, "playwright-report"), { recursive: true });
    const report = {
      suites: [
        {
          title: "payment.spec.ts",
          tests: [
            {
              title: "process payment",
              retries: 1,
              results: [
                { status: "failed", duration: 1500, error: { message: "timeout" } },
                { status: "passed", duration: 800 },
              ],
            },
          ],
        },
      ],
    };
    writeFileSync(join(tempDir, "playwright-report", "results.json"), JSON.stringify(report));

    const findings = await detectFlakyTests(tempDir);
    expect(findings.length).toBeGreaterThanOrEqual(1);
    const flaky = findings.find((f) => f.title.includes("process payment"));
    expect(flaky).toBeDefined();
    expect(flaky?.rule).toBe("flaky-test");
  });

  it("does not flag tests that consistently pass", async () => {
    mkdirSync(join(tempDir, "playwright-report"), { recursive: true });
    const report = {
      suites: [
        {
          title: "stable.spec.ts",
          tests: [
            {
              title: "reliable test",
              retries: 0,
              results: [{ status: "passed", duration: 300 }],
            },
          ],
        },
      ],
    };
    writeFileSync(join(tempDir, "playwright-report", "results.json"), JSON.stringify(report));

    const findings = await detectFlakyTests(tempDir);
    const flaky = findings.filter((f) => f.rule === "flaky-test" && f.title.includes("reliable test"));
    expect(flaky).toHaveLength(0);
  });
});
