import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { mkdirSync, writeFileSync, rmSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { loadScoringRules, DEFAULT_SCORING } from "../policies/scoring.js";

function makeTempDir(): string {
  const dir = join(tmpdir(), `inspectra-test-${Date.now()}-${Math.random().toString(36).slice(2)}`);
  mkdirSync(dir, { recursive: true });
  return dir;
}

describe("loadScoringRules", () => {
  let tempDir: string;

  beforeEach(() => {
    tempDir = makeTempDir();
  });
  afterEach(() => {
    rmSync(tempDir, { recursive: true, force: true });
  });

  it("returns default config when YAML is missing", async () => {
    const config = await loadScoringRules(tempDir);
    expect(config).toEqual(DEFAULT_SCORING);
  });

  it("loads custom weights from YAML", async () => {
    writeFileSync(
      join(tempDir, "scoring-rules.yml"),
      `severity_weights:\n  critical: 30\n  high: 20\n  medium: 10\n  low: 5\n  info: 0\ndomain_weights:\n  security: 0.5\n  tests: 0.5\n`,
    );
    const config = await loadScoringRules(tempDir);
    expect(config.severity_weights.critical).toBe(30);
    expect(config.domain_weights.security).toBe(0.5);
  });

  it("parses grade definitions", async () => {
    writeFileSync(
      join(tempDir, "scoring-rules.yml"),
      `severity_weights:\n  critical: 25\ndomain_weights:\n  security: 0.24\ngrades:\n  A:\n    min_score: 90\n    label: Excellent\n    description: Top quality\n`,
    );
    const config = await loadScoringRules(tempDir);
    expect(config.grades).toBeDefined();
    expect(config.grades!.A.min_score).toBe(90);
  });
});

describe("DEFAULT_SCORING", () => {
  it("has severity_weights with expected keys", () => {
    expect(DEFAULT_SCORING.severity_weights).toHaveProperty("critical");
    expect(DEFAULT_SCORING.severity_weights).toHaveProperty("high");
    expect(DEFAULT_SCORING.severity_weights).toHaveProperty("info");
  });

  it("has domain_weights that sum to ~1", () => {
    const sum = Object.values(DEFAULT_SCORING.domain_weights).reduce((a, b) => a + b, 0);
    expect(sum).toBeCloseTo(1.0, 1);
  });
});
