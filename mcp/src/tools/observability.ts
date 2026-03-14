import { readFile } from "node:fs/promises";
import { relative } from "node:path";
import type { Finding } from "../types.js";
import { collectSourceFiles } from "../utils/files.js";
import { createIdSequence } from "../utils/id.js";
import { getAllHealthDetectors } from "../strategies/health-detectors.js";

// ─── Patterns ─────────────────────────────────────────────────────────────────

/** Catch blocks that swallow errors (no log call and no re-throw inside). */
const THROW_STATEMENT = /\bthrow\b/;

/** Logger invocations (common logger patterns) */
const LOGGER_CALL =
  /(?:logger|log|console|this\.log|this\.logger|winston|bunyan|pino)\s*\.\s*(?:error|warn|info|debug|log|fatal)\s*\(/i;

/** Tracing setup patterns (OpenTelemetry, Jaeger, Zipkin) */
const TRACING_SETUP =
  /(?:@opentelemetry|opentelemetry|jaegerClient|zipkin|NodeTracerProvider|trace\.getTracer|initTracer)/i;

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
  let swallowedCatchCount = 0;
  const swallowedCatchSamples: Array<{ file: string; line: number }> = [];

  const healthDetectors = getAllHealthDetectors();

  for (const filePath of files) {
    try {
      const content = await readFile(filePath, "utf-8");
      const relPath = relative(projectDir, filePath);

      if (!hasHealthEndpoint) {
        hasHealthEndpoint = healthDetectors.some((d) => d.hasHealthEndpoint(content));
      }
      if (TRACING_SETUP.test(content)) hasTracingSetup = true;

      // Detect swallowed catch blocks
      for (const catchBlock of findCatchBlocks(content)) {
        if (!LOGGER_CALL.test(catchBlock.body) && !THROW_STATEMENT.test(catchBlock.body)) {
          swallowedCatchCount++;
          if (swallowedCatchSamples.length < 5) {
            swallowedCatchSamples.push({ file: relPath, line: catchBlock.line });
          }
        }
      }
    } catch {
      /* skip unreadable files */
    }
  }

  // ─── Config-based health detection (Actuator, etc.) ──────────────────────
  if (!hasHealthEndpoint) {
    for (const detector of healthDetectors) {
      if (await detector.hasHealthConfig(projectDir)) {
        hasHealthEndpoint = true;
        break;
      }
    }
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
    const entryFile = files.find((f) => /index\.(ts|js)$/.test(f)) ?? files[0];
    if (!entryFile) {
      return findings;
    }

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

type CatchBlock = {
  body: string;
  line: number;
};

function findCatchBlocks(content: string): CatchBlock[] {
  const blocks: CatchBlock[] = [];
  const catchPattern = /\bcatch\b/g;

  for (const match of content.matchAll(catchPattern)) {
    const catchIndex = match.index ?? -1;
    if (catchIndex < 0) continue;

    let cursor = catchIndex + match[0].length;
    while (cursor < content.length && /\s/.test(content[cursor] ?? "")) {
      cursor++;
    }

    if ((content[cursor] ?? "") === "(") {
      let parenDepth = 1;
      cursor++;
      while (cursor < content.length && parenDepth > 0) {
        const char = content[cursor] ?? "";
        if (char === "(") parenDepth++;
        if (char === ")") parenDepth--;
        cursor++;
      }
      while (cursor < content.length && /\s/.test(content[cursor] ?? "")) {
        cursor++;
      }
    }

    if ((content[cursor] ?? "") !== "{") continue;

    const bodyStart = cursor + 1;
    let braceDepth = 1;
    cursor = bodyStart;

    while (cursor < content.length && braceDepth > 0) {
      const char = content[cursor] ?? "";
      if (char === "{") braceDepth++;
      if (char === "}") braceDepth--;
      cursor++;
    }

    if (braceDepth !== 0) continue;

    const bodyEnd = cursor - 1;
    blocks.push({
      body: content.slice(bodyStart, bodyEnd),
      line: content.slice(0, catchIndex).split("\n").length,
    });
  }

  return blocks;
}
