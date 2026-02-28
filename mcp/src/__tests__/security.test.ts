import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { writeFileSync, mkdirSync, rmSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { scanSecrets } from "../tools/security.js";

const TMP_DIR = join(tmpdir(), "inspectra-test-secrets");

beforeAll(() => {
  mkdirSync(TMP_DIR, { recursive: true });
});

afterAll(() => {
  rmSync(TMP_DIR, { recursive: true, force: true });
});

function writeFixture(name: string, content: string): string {
  const path = join(TMP_DIR, name);
  writeFileSync(path, content, "utf8");
  return path;
}

describe("scanSecrets", () => {
  it("returns empty array for clean files", async () => {
    const file = writeFixture("clean.ts", `export const name = "hello world";\n`);
    const findings = await scanSecrets([file]);
    expect(findings).toHaveLength(0);
  });

  it("detects a hardcoded API key", async () => {
    const file = writeFixture("apikey.ts", `const API_KEY = "sk-abcdef1234567890abcdef1234567890";\n`);
    const findings = await scanSecrets([file]);
    expect(findings.length).toBeGreaterThan(0);
    expect(findings[0].domain).toBe("security");
    expect(findings[0].severity).toMatch(/critical|high/);
  });

  it("detects a private key header", async () => {
    const file = writeFixture("privkey.ts", `const key = "-----BEGIN RSA PRIVATE KEY-----";\n`);
    const findings = await scanSecrets([file]);
    expect(findings.length).toBeGreaterThan(0);
  });

  it("detects a hardcoded password in a connection string", async () => {
    const file = writeFixture("db.ts", `const DB = "postgresql://user:s3cr3tpassword@host:5432/db";\n`);
    const findings = await scanSecrets([file]);
    expect(findings.length).toBeGreaterThan(0);
  });

  it("attaches evidence with the correct file path", async () => {
    const file = writeFixture("apikey2.ts", `const TOKEN = "ghp_abcdefghijklmnopqrstuvwxyz012345";\n`);
    const findings = await scanSecrets([file]);
    if (findings.length > 0) {
      expect(findings[0].evidence?.[0]?.file).toBe(file);
    }
  });

  it("scans multiple files independently", async () => {
    const clean = writeFixture("multi-clean.ts", `export const x = 1;\n`);
    const dirty = writeFixture("multi-dirty.ts", `const SECRET = "sk-abcdef1234567890abcdef1234567890";\n`);
    const findings = await scanSecrets([clean, dirty]);
    const dirtyFindings = findings.filter((f) => f.evidence?.[0]?.file === dirty);
    expect(dirtyFindings.length).toBeGreaterThan(0);
    const cleanFindings = findings.filter((f) => f.evidence?.[0]?.file === clean);
    expect(cleanFindings).toHaveLength(0);
  });
});
