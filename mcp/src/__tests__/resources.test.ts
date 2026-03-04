import { describe, it, expect, afterEach } from "vitest";
import { setLatestReport } from "../register/resources.js";
import { readFile, rm } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";

const REPORT_DIR = join(tmpdir(), "inspectra");
const REPORT_PATH = join(REPORT_DIR, "latest-report.json");

describe("setLatestReport", () => {
  afterEach(async () => {
    try {
      await rm(REPORT_PATH, { force: true });
    } catch {
      /* ignore */
    }
  });

  it("writes the report to the temp directory", async () => {
    const reportJson = JSON.stringify({ overall_score: 42 });
    await setLatestReport(reportJson);
    const content = await readFile(REPORT_PATH, "utf-8");
    expect(content).toBe(reportJson);
  });

  it("overwrites an existing report", async () => {
    await setLatestReport('{"score":1}');
    await setLatestReport('{"score":2}');
    const content = await readFile(REPORT_PATH, "utf-8");
    expect(JSON.parse(content).score).toBe(2);
  });
});
