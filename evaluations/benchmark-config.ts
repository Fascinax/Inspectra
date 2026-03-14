/**
 * Benchmark configuration for ADR-008 architecture evaluation.
 *
 * Defines fixture repos, tier definitions, metric thresholds,
 * and scoring weights for comparing the runnable Tier A / B audit architectures.
 */

// ─── Types ──────────────────────────────────────────────────────────────────

export interface FixtureRepo {
  name: string;
  path: string;
  stack: string;
  groundTruthPath: string;
  description: string;
}

export interface TierDefinition {
  id: "A" | "B" | "C";
  name: string;
  promptPath: string;
  description: string;
}

export interface MetricThresholds {
  minPrecision: number;
  minRecall: number;
  maxVariance: number;
  minActionability: number;
}

export interface BenchmarkConfig {
  fixtures: FixtureRepo[];
  tiers: TierDefinition[];
  runsPerTier: number;
  thresholds: MetricThresholds;
}

// ─── Configuration ──────────────────────────────────────────────────────────

export const BENCHMARK_CONFIG: BenchmarkConfig = {
  fixtures: [
    {
      name: "bench-ts-express",
      path: "evaluations/fixtures/bench-ts-express",
      stack: "typescript-node",
      groundTruthPath: "evaluations/ground-truth/bench-ts-express.json",
      description: "Express REST API — security, API design, observability, tests, conventions, tech-debt",
    },
    {
      name: "bench-java-spring",
      path: "evaluations/fixtures/bench-java-spring",
      stack: "java-backend",
      groundTruthPath: "evaluations/ground-truth/bench-java-spring.json",
      description: "Spring Boot backend — security config, JPA anti-patterns, API design, observability",
    },
    {
      name: "bench-angular-app",
      path: "evaluations/fixtures/bench-angular-app",
      stack: "angular-frontend",
      groundTruthPath: "evaluations/ground-truth/bench-angular-app.json",
      description: "Angular 18 frontend — accessibility, i18n, UX consistency, conventions",
    },
    {
      name: "bench-messy-fullstack",
      path: "evaluations/fixtures/bench-messy-fullstack",
      stack: "typescript-node",
      groundTruthPath: "evaluations/ground-truth/bench-messy-fullstack.json",
      description: "Intentionally messy TS app — god class, secrets, dead code, bad naming, zero tests",
    },
  ],

  tiers: [
    {
      id: "A",
      name: "Single-Pass",
      promptPath: ".github/prompts/audit-tier-a.prompt.md",
      description: "All MCP tools + 1 LLM synthesis. No sub-agents.",
    },
    {
      id: "B",
      name: "Hybrid",
      promptPath: ".github/prompts/audit.prompt.md",
      description: "Default architecture: all MCP tools + structured analysis + conditional explorer for hotspots.",
    },
  ],

  runsPerTier: 3,

  thresholds: {
    minPrecision: 0.6,
    minRecall: 0.5,
    maxVariance: 0.15,
    minActionability: 3.0,
  },
};

// ─── Severity weights (for scoring alignment checks) ────────────────────────

export const SEVERITY_WEIGHTS: Record<string, number> = {
  critical: 25,
  high: 15,
  medium: 8,
  low: 3,
  info: 0,
};

// ─── Domain weights (from policies/scoring-rules.yml) ───────────────────────

export const DOMAIN_WEIGHTS: Record<string, number> = {
  security: 24,
  tests: 20,
  architecture: 16,
  conventions: 12,
  performance: 10,
  documentation: 8,
  "tech-debt": 10,
  accessibility: 8,
  "api-design": 7,
  observability: 6,
  i18n: 5,
  "ux-consistency": 6,
};
