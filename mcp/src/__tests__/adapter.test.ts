import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { mkdirSync, writeFileSync, rmSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { generateClaudeMd } from "../tools/adapter.js";

function makeTempDir(): string {
  const dir = join(tmpdir(), `inspectra-test-${Date.now()}-${Math.random().toString(36).slice(2)}`);
  mkdirSync(dir, { recursive: true });
  return dir;
}

describe("generateClaudeMd", () => {
  let tempDir: string;

  beforeEach(() => {
    tempDir = makeTempDir();
  });

  afterEach(() => {
    rmSync(tempDir, { recursive: true, force: true });
  });

  it("returns empty-agent output when directory does not exist", async () => {
    const result = await generateClaudeMd(join(tempDir, "nonexistent"));
    expect(result.agentCount).toBe(0);
    expect(result.agentFiles).toEqual([]);
    expect(result.content).toContain("Inspectra");
    expect(result.content).toContain("No agents found.");
  });

  it("returns empty-agent output when directory has no .agent.md files", async () => {
    writeFileSync(join(tempDir, "README.md"), "# readme");
    writeFileSync(join(tempDir, "notes.txt"), "notes");

    const result = await generateClaudeMd(tempDir);
    expect(result.agentCount).toBe(0);
    expect(result.agentFiles).toEqual([]);
  });

  it("reads a single agent file and produces CLAUDE.md content", async () => {
    writeFileSync(
      join(tempDir, "audit-security.agent.md"),
      "---\nname: audit-security\n---\n# Mission\nAudit security stuff.\n\n## Rules\n- Rule 1",
    );

    const result = await generateClaudeMd(tempDir);
    expect(result.agentCount).toBe(1);
    expect(result.agentFiles).toEqual(["audit-security.agent.md"]);
    expect(result.content).toContain("## Agent: Security");
    expect(result.content).toContain("Audit security stuff.");
    expect(result.content).toContain("Rule 1");
  });

  it("reads multiple agent files sorted alphabetically", async () => {
    writeFileSync(
      join(tempDir, "audit-tests.agent.md"),
      "---\nname: audit-tests\n---\nTest audit content.",
    );
    writeFileSync(
      join(tempDir, "audit-security.agent.md"),
      "---\nname: audit-security\n---\nSecurity audit content.",
    );
    writeFileSync(
      join(tempDir, "audit-architecture.agent.md"),
      "---\nname: audit-architecture\n---\nArch audit content.",
    );

    const result = await generateClaudeMd(tempDir);
    expect(result.agentCount).toBe(3);
    expect(result.agentFiles).toEqual([
      "audit-architecture.agent.md",
      "audit-security.agent.md",
      "audit-tests.agent.md",
    ]);
  });

  it("strips YAML frontmatter from agent content", async () => {
    writeFileSync(
      join(tempDir, "audit-i18n.agent.md"),
      "---\nname: audit-i18n\ndescription: i18n agent\n---\n# i18n Agent\nContent after frontmatter.",
    );

    const result = await generateClaudeMd(tempDir);
    expect(result.content).not.toContain("description: i18n agent");
    expect(result.content).toContain("Content after frontmatter.");
  });

  it("derives agent name correctly from filename", async () => {
    writeFileSync(
      join(tempDir, "audit-api-design.agent.md"),
      "---\nname: audit-api-design\n---\nAPI design checks.",
    );

    const result = await generateClaudeMd(tempDir);
    expect(result.content).toContain("## Agent: Api Design");
  });

  it("includes header with auto-generation notice", async () => {
    writeFileSync(
      join(tempDir, "audit-security.agent.md"),
      "---\nname: audit-security\n---\nContent.",
    );

    const result = await generateClaudeMd(tempDir);
    expect(result.content).toContain("# Inspectra — Claude Code Reference");
    expect(result.content).toContain("Auto-generated");
    expect(result.content).toContain("inspectra_generate_claude_md");
  });

  it("lists all agent files in Available Agents section", async () => {
    writeFileSync(
      join(tempDir, "audit-security.agent.md"),
      "---\nname: audit-security\n---\nContent.",
    );
    writeFileSync(
      join(tempDir, "audit-tests.agent.md"),
      "---\nname: audit-tests\n---\nContent.",
    );

    const result = await generateClaudeMd(tempDir);
    expect(result.content).toContain("- `audit-security.agent.md`");
    expect(result.content).toContain("- `audit-tests.agent.md`");
  });

  it("includes source path reference for each agent section", async () => {
    writeFileSync(
      join(tempDir, "audit-observability.agent.md"),
      "---\nname: audit-observability\n---\nObs content.",
    );

    const result = await generateClaudeMd(tempDir);
    expect(result.content).toContain("> Source: `.github/agents/audit-observability.agent.md`");
  });

  it("ignores files that are not .agent.md", async () => {
    writeFileSync(
      join(tempDir, "audit-security.agent.md"),
      "---\nname: audit-security\n---\nContent.",
    );
    writeFileSync(join(tempDir, "README.md"), "# Not an agent");
    writeFileSync(join(tempDir, "notes.agent.txt"), "Not an agent either");

    const result = await generateClaudeMd(tempDir);
    expect(result.agentCount).toBe(1);
    expect(result.agentFiles).toEqual(["audit-security.agent.md"]);
  });
});
