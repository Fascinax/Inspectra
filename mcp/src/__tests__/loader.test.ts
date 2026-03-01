import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { mkdirSync, writeFileSync, rmSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import {
  loadScoringRules,
  loadConfidenceRules,
  loadDeduplicationRules,
  loadProfile,
  loadAllPolicies,
  DEFAULT_SCORING,
  DEFAULT_CONFIDENCE,
} from "../policies/loader.js";

function makeTempDir(): string {
  const dir = join(tmpdir(), `inspectra-test-${Date.now()}-${Math.random().toString(36).slice(2)}`);
  mkdirSync(dir, { recursive: true });
  return dir;
}

describe("loadScoringRules", () => {
  let tempDir: string;

  beforeEach(() => { tempDir = makeTempDir(); });
  afterEach(() => { rmSync(tempDir, { recursive: true, force: true }); });

  it("loads severity and domain weights from YAML", async () => {
    writeFileSync(join(tempDir, "scoring-rules.yml"), `
severity_weights:
  critical: 30
  high: 20
  medium: 10
  low: 5
  info: 0
domain_weights:
  security: 0.50
  tests: 0.50
`);

    const config = await loadScoringRules(tempDir);
    expect(config.severity_weights.critical).toBe(30);
    expect(config.domain_weights.security).toBe(0.50);
  });

  it("returns defaults when file is missing", async () => {
    const config = await loadScoringRules(tempDir);
    expect(config).toEqual(DEFAULT_SCORING);
  });
});

describe("loadConfidenceRules", () => {
  let tempDir: string;

  beforeEach(() => { tempDir = makeTempDir(); });
  afterEach(() => { rmSync(tempDir, { recursive: true, force: true }); });

  it("loads thresholds from YAML", async () => {
    writeFileSync(join(tempDir, "confidence-rules.yml"), `
minimum_for_report: 0.4
minimum_for_pr_comment: 0.8
auto_dismiss_below: 0.1
`);

    const config = await loadConfidenceRules(tempDir);
    expect(config.minimum_for_report).toBe(0.4);
    expect(config.auto_dismiss_below).toBe(0.1);
  });

  it("returns defaults when file is missing", async () => {
    const config = await loadConfidenceRules(tempDir);
    expect(config).toEqual(DEFAULT_CONFIDENCE);
  });
});

describe("loadDeduplicationRules", () => {
  let tempDir: string;

  beforeEach(() => { tempDir = makeTempDir(); });
  afterEach(() => { rmSync(tempDir, { recursive: true, force: true }); });

  it("loads cross-domain aliases from YAML", async () => {
    writeFileSync(join(tempDir, "deduplication-rules.yml"), `
strategy: same-rule-same-location
cross_domain_aliases:
  - rules: [excessive-file-length, file-too-long]
    canonical: excessive-file-length
    keep_domain: conventions
`);

    const config = await loadDeduplicationRules(tempDir);
    expect(config.cross_domain_aliases.length).toBe(1);
    expect(config.cross_domain_aliases[0].canonical).toBe("excessive-file-length");
  });
});

describe("loadProfile", () => {
  let tempDir: string;

  beforeEach(() => {
    tempDir = makeTempDir();
    mkdirSync(join(tempDir, "profiles"), { recursive: true });
  });
  afterEach(() => { rmSync(tempDir, { recursive: true, force: true }); });

  it("loads profile-specific thresholds", async () => {
    writeFileSync(join(tempDir, "profiles", "strict.yml"), `
profile: strict
coverage:
  lines:
    minimum: 80
    target: 95
  branches:
    minimum: 70
    target: 90
  functions:
    minimum: 80
    target: 95
file_lengths:
  warning: 200
  error: 400
`);

    const profile = await loadProfile(tempDir, "strict");
    expect(profile.coverage?.lines?.target).toBe(95);
    expect(profile.file_lengths?.warning).toBe(200);
  });

  it("returns defaults when profile file is missing", async () => {
    const profile = await loadProfile(tempDir, "nonexistent");
    expect(profile.profile).toBe("generic");
    expect(profile.file_lengths?.warning).toBe(400);
  });
});

describe("loadAllPolicies", () => {
  it("loads all policy files in parallel", async () => {
    const tempDir = makeTempDir();
    mkdirSync(join(tempDir, "profiles"), { recursive: true });

    writeFileSync(join(tempDir, "scoring-rules.yml"), `
severity_weights:
  critical: 25
  high: 15
  medium: 8
  low: 3
  info: 0
domain_weights:
  security: 0.30
  tests: 0.25
`);
    writeFileSync(join(tempDir, "confidence-rules.yml"), `
minimum_for_report: 0.3
minimum_for_pr_comment: 0.7
auto_dismiss_below: 0.2
`);
    writeFileSync(join(tempDir, "deduplication-rules.yml"), `
strategy: same-rule-same-location
cross_domain_aliases: []
`);
    writeFileSync(join(tempDir, "profiles", "generic.yml"), `
profile: generic
file_lengths:
  warning: 400
  error: 800
`);

    const policies = await loadAllPolicies(tempDir, "generic");
    expect(policies.scoring).toBeDefined();
    expect(policies.confidence).toBeDefined();
    expect(policies.deduplication).toBeDefined();
    expect(policies.profile).toBeDefined();

    rmSync(tempDir, { recursive: true, force: true });
  });
});
