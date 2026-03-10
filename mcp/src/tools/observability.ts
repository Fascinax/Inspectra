import { readFile } from "node:fs/promises";
import { join, relative } from "node:path";
import type { Finding } from "../types.js";
import { collectSourceFiles } from "../utils/files.js";
import { createIdSequence } from "../utils/id.js";

// ─── Patterns ─────────────────────────────────────────────────────────────────

/** Catch blocks that swallow errors (no log call inside) — search in a two-step approach */
const CATCH_BLOCK = /catch\s*\([^)]*\)\s*\{([^}]*)\}/gs;

/** Logger invocations (common logger patterns) */
const LOGGER_CALL =
  /(?:logger|log|console|this\.log|this\.logger|winston|bunyan|pino)\s*\.\s*(?:error|warn|info|debug|log|fatal)\s*\(/i;

/** Health/readiness endpoint pattern */
const HEALTH_ENDPOINT = /(?:["'`]\/(?:health|ready|readiness|liveness|ping|status)["'`]|@GetMapping\s*\(\s*["']\/(?:health|ready|actuator)[^"']*["']\s*\))/i;

/** Tracing setup patterns (OpenTelemetry, Jaeger, Zipkin) */
const TRACING_SETUP =
  /(?:@opentelemetry|opentelemetry|jaegerClient|zipkin|NodeTracerProvider|trace\.getTracer|initTracer)/i;

/** Metrics setup (Prometheus, micrometer, etc.) */
const METRICS_SETUP =
  /(?:prometheus|prom-client|Counter\s*\(\s*{|Histogram\s*\(\s*{|MeterProvider|meterRegistry)/i;

const SOURCE_EXTENSIONS = [".ts", ".js", ".java"];

/**
 * Scans source files for common observability gaps:
 * - Swallowed exceptions in catch blocks (no logger call)
 * - Missing health/readiness endpoint
 * - No tracing setup detected
 * - No metrics instrumentation detected
 */
export async function checkObservability(projectDir: string, ignoreDirs?: string[]): Promise<Finding[]> {
  const files = await collectSourceFiles(projectDir, SOURCE_EXTENSIONS, ignoreDirs);

  const findings: Finding[] = [];
  const nextId = createIdSequence("OBS");

  let hasHealthEndpoint = false;
  let hasTracingSetup = false;
  let hasMetricsSetup = false;
  let swallowedCatchCount = 0;
  const swallowedCatchSamples: Array<{ file: string; line: number }> = [];

  for (const filePath of files) {
    try {
      const content = await readFile(filePath, "utf-8");
      const relPath = relative(projectDir, filePath);

      if (HEALTH_ENDPOINT.test(content)) hasHealthEndpoint = true;
      if (TRACING_SETUP.test(content)) hasTracingSetup = true;
      if (METRICS_SETUP.test(content)) hasMetricsSetup = true;

      // Detect swallowed catch blocks
      CATCH_BLOCK.lastIndex = 0;
      for (const m of content.matchAll(CATCH_BLOCK)) {
        const body = m[1] ?? "";
        if (!LOGGER_CALL.test(body)) {
          swallowedCatchCount++;
          if (swallowedCatchSamples.length < 5) {
            const line = content.slice(0, m.index ?? 0).split("\n").length;
            swallowedCatchSamples.push({ file: relPath, line });
          }
        }
      }
    } catch {
      /* skip unreadable files */
    }
  }

  // ─── Spring Boot Actuator detection via config files ──────────────────────
  if (!hasHealthEndpoint) {
    hasHealthEndpoint = await detectActuatorConfig(projectDir);
  }

  // Swallowed exceptions
  if (swallowedCatchCount > 0) {
    findings.push({
      id: nextId(),
      severity: swallowedCatchCount >= 5 ? "high" : "medium",
      title: `${swallowedCatchCount} catch block(s) swallow exceptions without logging`,
      description:
        `Found ${swallowedCatchCount} catch block(s) that neither log nor re-throw the caught exception. ` +
        "Silent failures prevent operators from diagnosing production issues.",
      domain: "observability",
      rule: "swallowed-exception",
      confidence: 0.85,
      evidence: swallowedCatchSamples,
      recommendation:
        "Add at least logger.error(err) or logger.warn(err) inside every catch block, or re-throw after logging.",
      effort: "small",
      tags: ["observability", "logging", "error-handling"],
      source: "tool",
    });
  }

  // Missing health endpoint
  if (!hasHealthEndpoint && files.length > 0) {
    const entryFile = files.find((f) => /index\.(ts|js)$/.test(f)) ?? files[0]!;
    findings.push({
      id: nextId(),
      severity: "medium",
      title: "No health/readiness endpoint detected",
      description:
        "No route matching /health, /ready, /readiness, /liveness, /ping, or /status was found. " +
        "Health endpoints are required for container orchestrators (Kubernetes, ECS) to manage pod lifecycle.",
      domain: "observability",
      rule: "missing-health-endpoint",
      confidence: 0.80,
      evidence: [{ file: relative(projectDir, entryFile), line: 1 }],
      recommendation:
        "Add a GET /health endpoint that returns HTTP 200 when the service is ready. " +
        "For Spring Boot, add spring-boot-starter-actuator. For Node.js, add app.get('/health', (_, res) => res.json({ status: 'ok' })).",
      effort: "small",
      tags: ["observability", "health-check", "kubernetes"],
      source: "tool",
    });
  }

  // Missing tracing
  if (!hasTracingSetup && files.length >= 5) {
    findings.push({
      id: nextId(),
      severity: "low",
      title: "No distributed tracing setup detected",
      description:
        "No OpenTelemetry, Jaeger, or Zipkin tracing initialization was found. " +
        "Distributed tracing is essential for diagnosing latency issues in multi-service architectures.",
      domain: "observability",
      rule: "missing-tracing",
      confidence: 0.80,
      evidence: [{ file: "." }],
      recommendation:
        "Instrument with OpenTelemetry: npm install @opentelemetry/sdk-node @opentelemetry/auto-instrumentations-node " +
        "and create a tracing.ts bootstrap file.",
      effort: "medium",
      tags: ["observability", "tracing", "opentelemetry"],
      source: "tool",
    });
  }

  return findings;
}

const ACTUATOR_DEPENDENCY = /spring-boot-starter-actuator/;
const ACTUATOR_MANAGEMENT_KEY = /management[\s.:]+endpoint|management[\s.:]+endpoints/;

async function detectActuatorConfig(projectDir: string): Promise<boolean> {
  // Check build manifests for Actuator dependency
  const manifests = ["pom.xml", "build.gradle", "build.gradle.kts"];
  for (const name of manifests) {
    try {
      const content = await readFile(join(projectDir, name), "utf-8");
      if (ACTUATOR_DEPENDENCY.test(content)) return true;
    } catch { /* file not found */ }
  }

  // Check Spring Boot application config files for management endpoint config
  const configFiles = await collectSourceFiles(projectDir, [".properties", ".yml", ".yaml"]);
  for (const filePath of configFiles) {
    try {
      const content = await readFile(filePath, "utf-8");
      if (ACTUATOR_MANAGEMENT_KEY.test(content)) return true;
    } catch { /* skip */ }
  }

  return false;
}
