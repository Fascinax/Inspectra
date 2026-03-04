import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { mkdirSync, writeFileSync, rmSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { loadSeverityMatrix } from "../policies/severity-matrix.js";

function makeTempDir(): string {
  const dir = join(tmpdir(), `inspectra-test-${Date.now()}-${Math.random().toString(36).slice(2)}`);
  mkdirSync(dir, { recursive: true });
  return dir;
}

describe("loadSeverityMatrix", () => {
  let tempDir: string;

  beforeEach(() => {
    tempDir = makeTempDir();
  });
  afterEach(() => {
    rmSync(tempDir, { recursive: true, force: true });
  });

  it("returns null when YAML is missing", async () => {
    const result = await loadSeverityMatrix(tempDir);
    expect(result).toBeNull();
  });

  it("loads severity defaults from YAML", async () => {
    writeFileSync(
      join(tempDir, "severity-matrix.yml"),
      `severity_defaults:\n  critical:\n    description: Must fix immediately\n    sla_days: 1\n  high:\n    description: Fix within a week\n    sla_days: 7\n`,
    );
    const result = await loadSeverityMatrix(tempDir);
    expect(result).not.toBeNull();
    expect(result!.severity_defaults.critical.sla_days).toBe(1);
    expect(result!.severity_defaults.high.description).toBe("Fix within a week");
  });

  it("handles null sla_days", async () => {
    writeFileSync(
      join(tempDir, "severity-matrix.yml"),
      `severity_defaults:\n  info:\n    description: Informational\n    sla_days: null\n`,
    );
    const result = await loadSeverityMatrix(tempDir);
    expect(result!.severity_defaults.info.sla_days).toBeNull();
  });
});
