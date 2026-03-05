import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { mkdirSync, writeFileSync, rmSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { checkRestConventions } from "../tools/api-design.js";

function makeTempDir(): string {
  const dir = join(tmpdir(), `inspectra-api-${Date.now()}-${Math.random().toString(36).slice(2)}`);
  mkdirSync(dir, { recursive: true });
  return dir;
}

describe("checkRestConventions", () => {
  let tempDir: string;

  beforeEach(() => { tempDir = makeTempDir(); });
  afterEach(() => { rmSync(tempDir, { recursive: true, force: true }); });

  it("returns empty array for project with no routes", async () => {
    const findings = await checkRestConventions(tempDir);
    expect(Array.isArray(findings)).toBe(true);
  });

  it("detects verb-based resource name (getUsers)", async () => {
    writeFileSync(
      join(tempDir, "routes.ts"),
      `import express from "express";
const router = express.Router();
router.get('/getUsers', (req, res) => res.json([]));
router.post('/createOrder', (req, res) => res.json({}));
router.delete('/deleteUser', (req, res) => res.json({}));
`,
    );
    const findings = await checkRestConventions(tempDir);
    expect(findings.some((f) => f.rule === "verb-based-resource-name")).toBe(true);
  });

  it("does NOT flag properly named routes", async () => {
    writeFileSync(
      join(tempDir, "routes.ts"),
      `const router = require('express').Router();
router.get('/api/v1/users', (req, res) => res.json([]));
router.post('/api/v1/orders', (req, res) => res.json({}));
router.delete('/api/v1/users/:id', (req, res) => res.json({}));
`,
    );
    const findings = await checkRestConventions(tempDir);
    const verbFindings = findings.filter((f) => f.rule === "verb-based-resource-name");
    expect(verbFindings).toHaveLength(0);
  });

  it("detects missing API versioning when 3+ routes present", async () => {
    writeFileSync(
      join(tempDir, "routes.ts"),
      `const router = { get: () => {}, post: () => {}, delete: () => {} };
router.get('/users', () => {});
router.post('/orders', () => {});
router.delete('/items', () => {});
`,
    );
    const findings = await checkRestConventions(tempDir);
    expect(findings.some((f) => f.rule === "missing-api-versioning")).toBe(true);
  });

  it("all findings have API- prefix", async () => {
    writeFileSync(
      join(tempDir, "routes.js"),
      `app.get('/getUsers', () => {});\napp.post('/createItem', () => {});\napp.delete('/removeUser', () => {});`,
    );
    const findings = await checkRestConventions(tempDir);
    for (const f of findings) {
      expect(f.id).toMatch(/^API-\d{3,4}$/);
      expect(f.domain).toBe("api-design");
      expect(f.source).toBe("tool");
    }
  });
});
