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

  it("detects camelCase path segments", async () => {
    writeFileSync(
      join(tempDir, "routes.ts"),
      `const router = require('express').Router();
router.get('/api/v1/userProfiles', (req, res) => res.json([]));
`,
    );
    const findings = await checkRestConventions(tempDir);
    expect(findings.some((f) => f.rule === "non-kebab-case-path")).toBe(true);
  });

  it("does not emit a duplicate casing finding for verb-based camelCase routes", async () => {
    writeFileSync(
      join(tempDir, "routes.ts"),
      `const router = require('express').Router();
router.get('/getUsers', (req, res) => res.json([]));
`,
    );
    const findings = await checkRestConventions(tempDir);
    expect(findings.filter((f) => f.rule === "verb-based-resource-name")).toHaveLength(1);
    expect(findings.filter((f) => f.rule === "non-kebab-case-path")).toHaveLength(0);
  });

  it("detects snake_case path segments", async () => {
    writeFileSync(
      join(tempDir, "routes.ts"),
      `const router = require('express').Router();
router.get('/api/v1/user_profiles', (req, res) => res.json([]));
`,
    );
    const findings = await checkRestConventions(tempDir);
    expect(findings.some((f) => f.rule === "non-kebab-case-path")).toBe(true);
  });

  it("does NOT flag kebab-case path segments", async () => {
    writeFileSync(
      join(tempDir, "routes.ts"),
      `const router = require('express').Router();
router.get('/api/v1/user-profiles', (req, res) => res.json([]));
router.get('/api/v1/orders/:id', (req, res) => res.json({}));
`,
    );
    const findings = await checkRestConventions(tempDir);
    const casingFindings = findings.filter((f) => f.rule === "non-kebab-case-path");
    expect(casingFindings).toHaveLength(0);
  });

  it("does NOT flag path parameters like :userId", async () => {
    writeFileSync(
      join(tempDir, "routes.ts"),
      `const router = require('express').Router();
router.get('/api/v1/users/:userId', (req, res) => res.json({}));
`,
    );
    const findings = await checkRestConventions(tempDir);
    const casingFindings = findings.filter((f) => f.rule === "non-kebab-case-path");
    expect(casingFindings).toHaveLength(0);
  });

  it("detects camelCase in Spring MVC route annotations", async () => {
    writeFileSync(
      join(tempDir, "UserController.java"),
      `@RestController
public class UserController {
    @GetMapping("/userProfiles")
    public List<User> getUserProfiles() { return List.of(); }
}`,
    );
    const findings = await checkRestConventions(tempDir);
    expect(findings.some((f) => f.rule === "non-kebab-case-path")).toBe(true);
  });

  it("detects HttpSession usage in REST controller", async () => {
    writeFileSync(
      join(tempDir, "SessionController.java"),
      `@RestController
public class SessionController {
    @PostMapping("/import")
    public String doImport(HttpSession session) {
        String id = session.getId();
        return id;
    }
}`,
    );
    const findings = await checkRestConventions(tempDir);
    const session = findings.filter((f) => f.rule === "stateful-rest-controller");
    expect(session).toHaveLength(1);
    expect(session[0]!.severity).toBe("high");
  });

  it("does not flag HttpSession in non-controller class", async () => {
    writeFileSync(
      join(tempDir, "SessionService.java"),
      `@Service
public class SessionService {
    public void track(HttpSession session) {
        session.getAttribute("user");
    }
}`,
    );
    const findings = await checkRestConventions(tempDir);
    expect(findings.filter((f) => f.rule === "stateful-rest-controller")).toHaveLength(0);
  });

  it("detects unpaginated list endpoint", async () => {
    writeFileSync(
      join(tempDir, "ListController.java"),
      `@RestController
public class ListController {
    @GetMapping("/cables")
    public ResponseEntity<List<CableDTO>> getCables() {
        return ResponseEntity.ok(service.findAll());
    }
}`,
    );
    const findings = await checkRestConventions(tempDir);
    const pagination = findings.filter((f) => f.rule === "unpaginated-list-endpoint");
    expect(pagination).toHaveLength(1);
    expect(pagination[0]!.severity).toBe("medium");
  });

  it("does not flag paginated endpoint", async () => {
    writeFileSync(
      join(tempDir, "PagedController.java"),
      `@RestController
public class PagedController {
    @GetMapping("/cables")
    public ResponseEntity<Page<CableDTO>> getCables(Pageable pageable) {
        return ResponseEntity.ok(service.findAll(pageable));
    }
}`,
    );
    const findings = await checkRestConventions(tempDir);
    expect(findings.filter((f) => f.rule === "unpaginated-list-endpoint")).toHaveLength(0);
  });
});
