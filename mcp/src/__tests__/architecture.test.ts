import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { mkdirSync, writeFileSync, rmSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { checkLayering, analyzeModuleDependencies } from "../tools/architecture.js";

function makeTempDir(): string {
  const dir = join(tmpdir(), `inspectra-test-${Date.now()}-${Math.random().toString(36).slice(2)}`);
  mkdirSync(dir, { recursive: true });
  return dir;
}

describe("checkLayering", () => {
  let tempDir: string;

  beforeEach(() => {
    tempDir = makeTempDir();
  });
  afterEach(() => {
    rmSync(tempDir, { recursive: true, force: true });
  });

  it("detects domain → infrastructure layer violation", async () => {
    const modelsDir = join(tempDir, "src", "domain", "models");
    const repoDir = join(tempDir, "src", "infrastructure", "repository");
    mkdirSync(modelsDir, { recursive: true });
    mkdirSync(repoDir, { recursive: true });

    writeFileSync(
      join(modelsDir, "order.ts"),
      `import { OrderRepo } from '../../infrastructure/repository/order-repo';\nexport class Order {}\n`,
    );
    writeFileSync(join(repoDir, "order-repo.ts"), "export class OrderRepo {}\n");

    const findings = await checkLayering(tempDir);
    expect(findings.length).toBeGreaterThanOrEqual(1);
    expect(findings[0].rule).toBe("no-layer-violation");
    expect(findings[0].title).toContain("domain");
    expect(findings[0].title).toContain("infrastructure");
  });

  it("allows infrastructure → domain dependency", async () => {
    const modelsDir = join(tempDir, "src", "domain", "models");
    const repoDir = join(tempDir, "src", "infrastructure", "repository");
    mkdirSync(modelsDir, { recursive: true });
    mkdirSync(repoDir, { recursive: true });

    writeFileSync(
      join(repoDir, "order-repo.ts"),
      `import { Order } from '../../domain/models/order';\nexport class OrderRepo {}\n`,
    );
    writeFileSync(join(modelsDir, "order.ts"), "export class Order {}\n");

    const findings = await checkLayering(tempDir);
    expect(findings.length).toBe(0);
  });

  it("returns empty for projects with no layered structure", async () => {
    const srcDir = join(tempDir, "src");
    mkdirSync(srcDir, { recursive: true });
    writeFileSync(join(srcDir, "app.ts"), "console.log('hello');\n");

    const findings = await checkLayering(tempDir);
    expect(findings.length).toBe(0);
  });
});

describe("analyzeModuleDependencies", () => {
  let tempDir: string;

  beforeEach(() => {
    tempDir = makeTempDir();
  });
  afterEach(() => {
    rmSync(tempDir, { recursive: true, force: true });
  });

  it("flags excessive dependency count", async () => {
    const deps: Record<string, string> = {};
    for (let i = 0; i < 85; i++) {
      deps[`@scope/package-${i}`] = "^1.0.0";
    }
    writeFileSync(join(tempDir, "package.json"), JSON.stringify({ dependencies: deps }));

    const findings = await analyzeModuleDependencies(tempDir);
    const excessiveDep = findings.find((f) => f.rule === "excessive-dependencies");
    expect(excessiveDep).toBeDefined();
    expect(excessiveDep!.title).toContain("85");
  });

  it("returns empty for small dependency set", async () => {
    writeFileSync(
      join(tempDir, "package.json"),
      JSON.stringify({
        dependencies: { express: "^4.0.0", zod: "^3.0.0" },
      }),
    );

    const findings = await analyzeModuleDependencies(tempDir);
    expect(findings.filter((f) => f.rule === "excessive-dependencies").length).toBe(0);
  });

  it("returns empty when no package.json exists", async () => {
    const findings = await analyzeModuleDependencies(tempDir);
    expect(findings.length).toBe(0);
  });
});
