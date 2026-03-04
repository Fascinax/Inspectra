import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { mkdirSync, rmSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { logActivity, readActivityLog } from "../tools/governance.js";

function makeTempDir(): string {
  const dir = join(tmpdir(), `inspectra-test-${Date.now()}-${Math.random().toString(36).slice(2)}`);
  mkdirSync(dir, { recursive: true });
  return dir;
}

describe("logActivity", () => {
  let tempDir: string;

  beforeEach(() => {
    tempDir = makeTempDir();
  });
  afterEach(() => {
    rmSync(tempDir, { recursive: true, force: true });
  });

  it("creates the log file and returns success", async () => {
    const result = await logActivity(tempDir, "audit-security", "scan", ["inspectra_scan_secrets"], [], "success");
    expect(result.logged).toBe(true);
    expect(result.path).toContain(".inspectra");
  });

  it("appends a valid JSONL entry", async () => {
    await logActivity(tempDir, "audit-tests", "test", [], [], "success");
    const logPath = join(tempDir, ".inspectra", "agent-activity.jsonl");
    const content = readFileSync(logPath, "utf-8").trim();
    const entry = JSON.parse(content);
    expect(entry.agent).toBe("audit-tests");
    expect(entry.outcome).toBe("success");
  });

  it("rejects invalid agent name", async () => {
    await expect(logActivity(tempDir, "invalid-agent", "test", [], [], "success")).rejects.toThrow(/Invalid agent/);
  });
});

describe("readActivityLog", () => {
  let tempDir: string;

  beforeEach(() => {
    tempDir = makeTempDir();
  });
  afterEach(() => {
    rmSync(tempDir, { recursive: true, force: true });
  });

  it("returns empty array when no log exists", async () => {
    const entries = await readActivityLog(tempDir);
    expect(entries).toEqual([]);
  });

  it("reads entries written by logActivity", async () => {
    await logActivity(tempDir, "audit-security", "scan", [], [], "success");
    await logActivity(tempDir, "audit-tests", "test", [], [], "failure");
    const entries = await readActivityLog(tempDir);
    expect(entries).toHaveLength(2);
  });

  it("filters by agent name", async () => {
    await logActivity(tempDir, "audit-security", "scan", [], [], "success");
    await logActivity(tempDir, "audit-tests", "test", [], [], "failure");
    const entries = await readActivityLog(tempDir, "audit-security");
    expect(entries).toHaveLength(1);
    expect(entries[0].agent).toBe("audit-security");
  });
});
