import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { mkdirSync, writeFileSync, rmSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { generateClaudeMd, generateCodexAgentsMd } from "../tools/adapter.js";

function makeTempDir(): string {
  const dir = join(tmpdir(), `inspectra-test-${Date.now()}-${Math.random().toString(36).slice(2)}`);
  mkdirSync(dir, { recursive: true });
  return dir;
}

function writePrompt(projectDir: string, name: string): void {
  const promptsDir = join(projectDir, ".github", "prompts");
  mkdirSync(promptsDir, { recursive: true });
  writeFileSync(join(promptsDir, name), "---\ndescription: sample\n---\n", "utf-8");
}

describe("generateClaudeMd", () => {
  let tempDir: string;

  beforeEach(() => {
    tempDir = makeTempDir();
  });

  afterEach(() => {
    rmSync(tempDir, { recursive: true, force: true });
  });

  it("returns workflow-only output when prompts directory does not exist", async () => {
    const result = await generateClaudeMd(tempDir);
    expect(result.referenceCount).toBe(0);
    expect(result.includedFiles).toEqual([]);
    expect(result.content).toContain("Inspectra");
    expect(result.content).toContain("No prompt shortcuts found.");
  });

  it("lists prompt files when present", async () => {
    writePrompt(tempDir, "audit.prompt.md");
    writePrompt(tempDir, "audit-pr.prompt.md");

    const result = await generateClaudeMd(tempDir);
    expect(result.referenceCount).toBe(2);
    expect(result.includedFiles).toEqual(["audit-pr.prompt.md", "audit.prompt.md"]);
    expect(result.content).toContain("## Prompt Shortcuts");
    expect(result.content).toContain("audit.prompt.md");
  });

  it("includes the workflow and MCP tools sections", async () => {
    const result = await generateClaudeMd(tempDir);
    expect(result.content).toContain("## Workflow Overview");
    expect(result.content).toContain("## MCP Tools");
    expect(result.content).toContain("inspectra_scan_secrets");
  });
});

describe("generateCodexAgentsMd", () => {
  let tempDir: string;

  beforeEach(() => {
    tempDir = makeTempDir();
  });

  afterEach(() => {
    rmSync(tempDir, { recursive: true, force: true });
  });

  it("returns workflow-only output when prompts directory does not exist", async () => {
    const result = await generateCodexAgentsMd(tempDir);
    expect(result.referenceCount).toBe(0);
    expect(result.includedFiles).toEqual([]);
    expect(result.content).toContain("Inspectra");
    expect(result.content).toContain("No prompt shortcuts found.");
  });

  it("lists prompt files when present", async () => {
    writePrompt(tempDir, "audit-domain.prompt.md");

    const result = await generateCodexAgentsMd(tempDir);
    expect(result.referenceCount).toBe(1);
    expect(result.includedFiles).toEqual(["audit-domain.prompt.md"]);
    expect(result.content).toContain("## Prompt Shortcuts");
  });

  it("includes codex-specific workflow guidance", async () => {
    const result = await generateCodexAgentsMd(tempDir);
    expect(result.content).toContain("# Inspectra — Codex Project Instructions");
    expect(result.content).toContain("/mcp");
  });
});
