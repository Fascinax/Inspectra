import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { mkdirSync, writeFileSync, rmSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { loadIgnoreRules, applyIgnoreRules } from "../utils/ignore.js";
import type { Finding } from "../types.js";

function makeTempDir(): string {
  const dir = join(tmpdir(), `inspectra-test-${Date.now()}-${Math.random().toString(36).slice(2)}`);
  mkdirSync(dir, { recursive: true });
  return dir;
}

function makeFinding(overrides: Partial<Finding> = {}): Finding {
  return {
    id: "TST-001",
    severity: "medium",
    title: "Test finding",
    description: "Description",
    domain: "tests",
    rule: "test-rule",
    confidence: 0.8,
    evidence: [{ file: "src/app.ts" }],
    recommendation: "Fix it",
    effort: "small",
    tags: [],
    source: "tool",
    ...overrides,
  };
}

describe("loadIgnoreRules", () => {
  let tempDir: string;

  beforeEach(() => {
    tempDir = makeTempDir();
  });

  afterEach(() => {
    rmSync(tempDir, { recursive: true, force: true });
  });

  it("returns empty array when .inspectraignore does not exist", async () => {
    const rules = await loadIgnoreRules(tempDir);
    expect(rules).toEqual([]);
  });

  it("parses rule-only entries", async () => {
    writeFileSync(join(tempDir, ".inspectraignore"), "no-hardcoded-secret\n");
    const rules = await loadIgnoreRules(tempDir);
    expect(rules).toEqual([{ rule: "no-hardcoded-secret", file: "*" }]);
  });

  it("parses rule:file entries", async () => {
    writeFileSync(join(tempDir, ".inspectraignore"), "dry-violation:src/generated/\n");
    const rules = await loadIgnoreRules(tempDir);
    expect(rules).toEqual([{ rule: "dry-violation", file: "src/generated/" }]);
  });

  it("parses wildcard file patterns", async () => {
    writeFileSync(join(tempDir, ".inspectraignore"), "*:vendor/\n");
    const rules = await loadIgnoreRules(tempDir);
    expect(rules).toEqual([{ rule: "*", file: "vendor/" }]);
  });

  it("ignores comment lines", async () => {
    writeFileSync(
      join(tempDir, ".inspectraignore"),
      "# This is a comment\ntest-rule\n# Another comment\n",
    );
    const rules = await loadIgnoreRules(tempDir);
    expect(rules).toEqual([{ rule: "test-rule", file: "*" }]);
  });

  it("ignores blank lines", async () => {
    writeFileSync(join(tempDir, ".inspectraignore"), "\n\ntest-rule\n\n");
    const rules = await loadIgnoreRules(tempDir);
    expect(rules).toEqual([{ rule: "test-rule", file: "*" }]);
  });

  it("handles multiple rules", async () => {
    writeFileSync(
      join(tempDir, ".inspectraignore"),
      "rule-one\nrule-two:src/foo/\nrule-three:src/bar/\n",
    );
    const rules = await loadIgnoreRules(tempDir);
    expect(rules).toEqual([
      { rule: "rule-one", file: "*" },
      { rule: "rule-two", file: "src/foo/" },
      { rule: "rule-three", file: "src/bar/" },
    ]);
  });
});

describe("applyIgnoreRules", () => {
  it("returns all findings when no rules are provided", () => {
    const findings = [makeFinding()];
    const result = applyIgnoreRules(findings, []);
    expect(result).toEqual(findings);
  });

  it("suppresses finding when rule matches exactly", () => {
    const findings = [makeFinding({ rule: "test-rule" })];
    const rules = [{ rule: "test-rule", file: "*" }];
    const result = applyIgnoreRules(findings, rules);
    expect(result).toEqual([]);
  });

  it("suppresses finding when rule is wildcard", () => {
    const findings = [makeFinding({ rule: "any-rule" })];
    const rules = [{ rule: "*", file: "*" }];
    const result = applyIgnoreRules(findings, rules);
    expect(result).toEqual([]);
  });

  it("suppresses finding when file path matches", () => {
    const findings = [makeFinding({ rule: "test-rule", evidence: [{ file: "src/generated/file.ts" }] })];
    const rules = [{ rule: "test-rule", file: "generated/" }];
    const result = applyIgnoreRules(findings, rules);
    expect(result).toEqual([]);
  });

  it("does not suppress when rule does not match", () => {
    const findings = [makeFinding({ rule: "test-rule" })];
    const rules = [{ rule: "other-rule", file: "*" }];
    const result = applyIgnoreRules(findings, rules);
    expect(result).toEqual(findings);
  });

  it("does not suppress when file path does not match", () => {
    const findings = [makeFinding({ rule: "test-rule", evidence: [{ file: "src/app.ts" }] })];
    const rules = [{ rule: "test-rule", file: "vendor/" }];
    const result = applyIgnoreRules(findings, rules);
    expect(result).toEqual(findings);
  });

  it("suppresses when any evidence file matches", () => {
    const findings = [
      makeFinding({
        rule: "test-rule",
        evidence: [{ file: "src/app.ts" }, { file: "vendor/lib.ts" }],
      }),
    ];
    const rules = [{ rule: "test-rule", file: "vendor/" }];
    const result = applyIgnoreRules(findings, rules);
    expect(result).toEqual([]);
  });

  it("handles multiple rules and applies all suppressions", () => {
    const findings = [
      makeFinding({ rule: "rule-one", evidence: [{ file: "src/a.ts" }] }),
      makeFinding({ rule: "rule-two", evidence: [{ file: "src/b.ts" }] }),
      makeFinding({ rule: "rule-three", evidence: [{ file: "src/c.ts" }] }),
    ];
    const rules = [
      { rule: "rule-one", file: "*" },
      { rule: "rule-two", file: "*" },
    ];
    const result = applyIgnoreRules(findings, rules);
    expect(result).toEqual([findings[2]]);
  });
});
