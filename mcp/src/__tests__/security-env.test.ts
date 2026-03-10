import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { writeFileSync, mkdirSync, rmSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { scanSecrets, scanSecretsInDir } from "../tools/security.js";

const TMP_DIR = join(tmpdir(), "inspectra-test-secrets-env");

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

describe("scanSecrets — unquoted secret pattern", () => {
  it("detects unquoted PASSWORD in .env file", async () => {
    const file = writeFixture("app.env", "DB_PASSWORD=superSecretValue123\n");
    const findings = await scanSecrets([file]);
    const matched = findings.filter((f) => f.rule === "no-hardcoded-secret-unquoted");
    expect(matched.length).toBeGreaterThan(0);
  });

  it("detects unquoted SECRET in .properties file", async () => {
    const file = writeFixture("app.properties", "spring.datasource.password=s3cr3tValue123\n");
    const findings = await scanSecrets([file]);
    const matched = findings.filter((f) => f.rule === "no-hardcoded-secret-unquoted");
    expect(matched.length).toBeGreaterThan(0);
  });

  it("does not flag short unquoted values", async () => {
    const file = writeFixture("short.env", "DB_PASSWORD=short\n");
    const findings = await scanSecrets([file]);
    const matched = findings.filter((f) => f.rule === "no-hardcoded-secret-unquoted");
    expect(matched).toHaveLength(0);
  });

  it("does not flag placeholder values", async () => {
    const file = writeFixture("placeholder.env", "API_KEY=changeme_placeholder\n");
    const findings = await scanSecrets([file]);
    const matched = findings.filter((f) => f.rule === "no-hardcoded-secret-unquoted");
    expect(matched).toHaveLength(0);
  });
});

describe("scanSecrets — .env file detection", () => {
  it("flags a committed .env file", async () => {
    const file = writeFixture(".env", "APP_PORT=8080\n");
    const findings = await scanSecrets([file]);
    const committed = findings.filter((f) => f.rule === "no-env-file-committed");
    expect(committed.length).toBeGreaterThan(0);
  });

  it("flags a committed .env.local file", async () => {
    const file = writeFixture(".env.local", "SECRET=test\n");
    const findings = await scanSecrets([file]);
    const committed = findings.filter((f) => f.rule === "no-env-file-committed");
    expect(committed.length).toBeGreaterThan(0);
  });

  it("flags local.env (non-dotfile env)", async () => {
    const file = writeFixture("local.env", "DB_HOST=localhost\n");
    const findings = await scanSecrets([file]);
    const committed = findings.filter((f) => f.rule === "no-env-file-committed");
    expect(committed.length).toBeGreaterThan(0);
  });

  it("flags production.env", async () => {
    const file = writeFixture("production.env", "DB_PASSWORD=prodSecret\n");
    const findings = await scanSecrets([file]);
    const committed = findings.filter((f) => f.rule === "no-env-file-committed");
    expect(committed.length).toBeGreaterThan(0);
  });
});

describe("scanSecretsInDir — dot file inclusion", () => {
  it("scans .env files in directory mode", async () => {
    const subDir = join(TMP_DIR, "dotenv-test");
    mkdirSync(subDir, { recursive: true });
    writeFileSync(join(subDir, ".env"), "SECRET_KEY=veryLongSecretValueHere123\n", "utf8");
    writeFileSync(join(subDir, "clean.ts"), "export const x = 1;\n", "utf8");

    const findings = await scanSecretsInDir(subDir);
    const envFindings = findings.filter(
      (f) => f.rule === "no-env-file-committed" || f.rule === "no-hardcoded-secret-unquoted",
    );
    expect(envFindings.length).toBeGreaterThan(0);
  });
});
