import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { mkdirSync, writeFileSync, rmSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { loadConfidenceRules, DEFAULT_CONFIDENCE } from "../policies/confidence.js";

function makeTempDir(): string {
  const dir = join(tmpdir(), `inspectra-test-${Date.now()}-${Math.random().toString(36).slice(2)}`);
  mkdirSync(dir, { recursive: true });
  return dir;
}

describe("loadConfidenceRules", () => {
  let tempDir: string;

  beforeEach(() => {
    tempDir = makeTempDir();
  });
  afterEach(() => {
    rmSync(tempDir, { recursive: true, force: true });
  });

  it("returns default config when YAML is missing", async () => {
    const config = await loadConfidenceRules(tempDir);
    expect(config).toEqual(DEFAULT_CONFIDENCE);
  });

  it("loads custom thresholds from YAML", async () => {
    writeFileSync(
      join(tempDir, "confidence-rules.yml"),
      `minimum_for_report: 0.5\nminimum_for_pr_comment: 0.8\nauto_dismiss_below: 0.1\n`,
    );
    const config = await loadConfidenceRules(tempDir);
    expect(config.minimum_for_report).toBe(0.5);
    expect(config.minimum_for_pr_comment).toBe(0.8);
    expect(config.auto_dismiss_below).toBe(0.1);
  });

  it("parses adjustments array", async () => {
    writeFileSync(
      join(tempDir, "confidence-rules.yml"),
      `minimum_for_report: 0.3\nminimum_for_pr_comment: 0.7\nauto_dismiss_below: 0.2\nadjustments:\n  - condition: test\n    description: boost\n    delta: 0.1\n`,
    );
    const config = await loadConfidenceRules(tempDir);
    expect(config.adjustments).toHaveLength(1);
    expect(config.adjustments![0].delta).toBe(0.1);
  });
});

describe("DEFAULT_CONFIDENCE", () => {
  it("has expected threshold values", () => {
    expect(DEFAULT_CONFIDENCE.minimum_for_report).toBe(0.3);
    expect(DEFAULT_CONFIDENCE.minimum_for_pr_comment).toBe(0.7);
    expect(DEFAULT_CONFIDENCE.auto_dismiss_below).toBe(0.2);
  });
});
