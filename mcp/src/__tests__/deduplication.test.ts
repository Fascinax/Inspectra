import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { mkdirSync, writeFileSync, rmSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { loadDeduplicationRules } from "../policies/deduplication.js";

function makeTempDir(): string {
  const dir = join(tmpdir(), `inspectra-test-${Date.now()}-${Math.random().toString(36).slice(2)}`);
  mkdirSync(dir, { recursive: true });
  return dir;
}

describe("loadDeduplicationRules", () => {
  let tempDir: string;

  beforeEach(() => {
    tempDir = makeTempDir();
  });
  afterEach(() => {
    rmSync(tempDir, { recursive: true, force: true });
  });

  it("returns default config when YAML is missing", async () => {
    const config = await loadDeduplicationRules(tempDir);
    expect(config.strategy).toBe("same-rule-same-location");
    expect(config.cross_domain_aliases).toEqual([]);
  });

  it("loads custom strategy from YAML", async () => {
    writeFileSync(
      join(tempDir, "deduplication-rules.yml"),
      `strategy: custom-strategy\ncross_domain_aliases: []\n`,
    );
    const config = await loadDeduplicationRules(tempDir);
    expect(config.strategy).toBe("custom-strategy");
  });

  it("parses cross-domain aliases", async () => {
    writeFileSync(
      join(tempDir, "deduplication-rules.yml"),
      `strategy: same-rule-same-location\ncross_domain_aliases:\n  - rules: [rule-a, rule-b]\n    canonical: rule-a\n    keep_domain: security\n`,
    );
    const config = await loadDeduplicationRules(tempDir);
    expect(config.cross_domain_aliases).toHaveLength(1);
    expect(config.cross_domain_aliases[0].canonical).toBe("rule-a");
  });
});
