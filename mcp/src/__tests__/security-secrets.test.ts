import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { mkdirSync, writeFileSync, rmSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { scanSecrets, SECRET_PATTERNS } from "../tools/security-secrets.js";

function makeTempDir(): string {
  const dir = join(tmpdir(), `inspectra-secrets-${Date.now()}-${Math.random().toString(36).slice(2)}`);
  mkdirSync(dir, { recursive: true });
  return dir;
}

function writeFixture(dir: string, name: string, content: string): string {
  const path = join(dir, name);
  writeFileSync(path, content, "utf8");
  return path;
}

describe("SECRET_PATTERNS", () => {
  it("defines patterns for common secret types", () => {
    const rules = SECRET_PATTERNS.map((p) => p.rule);
    expect(rules).toContain("no-hardcoded-secret");
    expect(rules).toContain("no-private-key");
    expect(rules).toContain("no-jwt-hardcoded");
    expect(rules).toContain("no-connection-string");
  });

  it("classifies private keys as critical severity", () => {
    const privateKey = SECRET_PATTERNS.find((p) => p.rule === "no-private-key");
    expect(privateKey?.severity).toBe("critical");
  });
});

describe("scanSecrets", () => {
  let tempDir: string;

  beforeEach(() => {
    tempDir = makeTempDir();
  });

  afterEach(() => {
    rmSync(tempDir, { recursive: true, force: true });
  });

  it("returns empty for clean files", async () => {
    const file = writeFixture(tempDir, "clean.ts", "export const greeting = 'Hello, world!';\n");
    const findings = await scanSecrets([file]);
    expect(findings).toEqual([]);
  });

  it("detects hardcoded passwords", async () => {
    const file = writeFixture(tempDir, "config.ts", 'const password = "supersecret123";\n');
    const findings = await scanSecrets([file]);
    expect(findings.length).toBe(1);
    expect(findings[0].rule).toBe("no-hardcoded-secret");
    expect(findings[0].severity).toBe("high");
  });

  it("detects private keys", async () => {
    const file = writeFixture(tempDir, "key.pem", "-----BEGIN RSA PRIVATE KEY-----\ndata\n");
    const findings = await scanSecrets([file]);
    expect(findings.length).toBe(1);
    expect(findings[0].rule).toBe("no-private-key");
    expect(findings[0].severity).toBe("critical");
  });

  it("detects connection strings", async () => {
    const file = writeFixture(tempDir, "db.ts", 'const dbUrl = "postgresql://user:pass@localhost:5432/mydb";\n');
    const findings = await scanSecrets([file]);
    expect(findings.some((f) => f.rule === "no-connection-string")).toBe(true);
  });

  it("supports custom additional patterns", async () => {
    const file = writeFixture(tempDir, "app.ts", "const GITHUB_TOKEN = ghp_abc123def456ghi789jkl;\n");
    const findings = await scanSecrets([file], [
      { rule: "no-github-token", pattern: "ghp_[A-Za-z0-9]{20,}", severity: "high" },
    ]);
    expect(findings.some((f) => f.rule === "no-github-token")).toBe(true);
  });

  it("assigns SEC-xxx IDs", async () => {
    const file = writeFixture(tempDir, "config2.ts", 'const secret = "my-secret-password123";\n');
    const findings = await scanSecrets([file]);
    expect(findings[0].id).toMatch(/^SEC-\d{3}$/);
  });

  it("skips unreadable files gracefully", async () => {
    const findings = await scanSecrets([join(tempDir, "nonexistent.ts")]);
    expect(findings).toEqual([]);
  });
});
