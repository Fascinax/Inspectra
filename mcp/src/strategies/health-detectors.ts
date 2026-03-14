import { readFile } from "node:fs/promises";
import { join } from "node:path";
import type { HealthDetector } from "./types.js";
import { collectSourceFiles } from "../utils/files.js";

// ─── Node.js (Express, Fastify, Hapi, etc.) ─────────────────────────────────

const NODE_HEALTH_ROUTE_PATTERN =
  /(?:\b(?:app|router|server|fastify)\s*\.\s*(?:get|use|head|all)|\b(?:get|head|all)\s*\()\s*\(?\s*["'`]\/(?:health|ready|readiness|liveness|ping|status)(?:[/?][^"'`]*)?["'`]/i;

const NODE_HEALTH_HANDLER_PATTERN =
  /(?:route|endpoint)\s*[:=]\s*["'`]\/(?:health|ready|readiness|liveness|ping|status)(?:[/?][^"'`]*)?["'`]/i;

const nodeDetector: HealthDetector = {
  hasHealthEndpoint(content) {
    return NODE_HEALTH_ROUTE_PATTERN.test(content) || NODE_HEALTH_HANDLER_PATTERN.test(content);
  },
  async hasHealthConfig() {
    return false;
  },
};

// ─── Spring Boot ─────────────────────────────────────────────────────────────

const SPRING_HEALTH_PATTERN =
  /@GetMapping\s*\(\s*["']\/(?:health|ready|actuator)[^"']*["']\s*\)/i;

const ACTUATOR_DEPENDENCY = /spring-boot-starter-actuator/;
const ACTUATOR_MANAGEMENT_KEY =
  /management[\s.:]+endpoint|management[\s.:]+endpoints/;

const springDetector: HealthDetector = {
  hasHealthEndpoint(content) {
    return SPRING_HEALTH_PATTERN.test(content);
  },

  async hasHealthConfig(projectDir) {
    const manifests = ["pom.xml", "build.gradle", "build.gradle.kts"];
    for (const name of manifests) {
      try {
        const content = await readFile(join(projectDir, name), "utf-8");
        if (ACTUATOR_DEPENDENCY.test(content)) return true;
      } catch { /* file not found */ }
    }

    const configFiles = await collectSourceFiles(
      projectDir,
      [".properties", ".yml", ".yaml"],
    );
    for (const filePath of configFiles) {
      try {
        const content = await readFile(filePath, "utf-8");
        if (ACTUATOR_MANAGEMENT_KEY.test(content)) return true;
      } catch { /* skip */ }
    }

    return false;
  },
};

// ─── Registry ────────────────────────────────────────────────────────────────

const ALL_DETECTORS: ReadonlyArray<HealthDetector> = [nodeDetector, springDetector];

export function getAllHealthDetectors(): ReadonlyArray<HealthDetector> {
  return ALL_DETECTORS;
}
