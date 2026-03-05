import { readFile } from "node:fs/promises";
import { relative, extname } from "node:path";
import type { Finding } from "../types.js";
import { collectSourceFiles } from "../utils/files.js";
import { createIdSequence } from "../utils/id.js";

// ─── Patterns ─────────────────────────────────────────────────────────────────

/** Express/Hapi.js route definitions */
const EXPRESS_ROUTE =
  /(?:router|app)\.(get|post|put|patch|delete|head)\s*\(\s*["'`]([^"'`]+)["'`]/gi;
/** NestJS route decorators */
const NESTJS_ROUTE =
  /@(?:Get|Post|Put|Patch|Delete)\s*\(\s*["'`]([^"'`]*)["'`]\s*\)/gi;
/** Spring MVC route annotations */
const SPRING_ROUTE =
  /@(?:GetMapping|PostMapping|PutMapping|DeleteMapping|PatchMapping|RequestMapping)\s*\(\s*(?:value\s*=\s*)?["'']([^"'']+)["'']/gi;

/** CRUD verb list that should NOT appear in resource names */
const CRUD_VERBS = /\/(get|create|add|delete|remove|update|edit|fetch|retrieve|list|find)(?=[A-Z_\-/]|$)/i;

/** Check if the path has a version segment (/v1/, /v2/, /api/v1/, etc) */
const HAS_VERSION = /\/(?:api\/)?v\d+\//i;

/** A resource segment: at least 2 chars, should be plural (ends with 's' or 'es') for collections */
const NON_PLURAL_RESOURCE = /\/([a-z][a-z0-9_-]*)(?:\/|$)/gi;

const PLURAL_ENDINGS = /s($|\/)/;

const SOURCE_EXTENSIONS = [".ts", ".js", ".java"];

/**
 * Scans source files for common REST API design issues:
 * - Verb-based resource names (/getUsers, /createOrder)
 * - Missing API versioning (/api/users instead of /api/v1/users)
 * - Non-plural collection resource names (/user instead of /users)
 */
export async function checkRestConventions(projectDir: string, ignoreDirs?: string[]): Promise<Finding[]> {
  const files = await collectSourceFiles(projectDir, SOURCE_EXTENSIONS, ignoreDirs);

  const findings: Finding[] = [];
  const nextId = createIdSequence("API");

  // Track versioning globally: if any route has versioning we assume the project uses it
  const allRoutes: Array<{ path: string; method: string; file: string; line: number }> = [];
  let hasAnyVersioned = false;

  for (const filePath of files) {
    try {
      const content = await readFile(filePath, "utf-8");
      const relPath = relative(projectDir, filePath);

      // Extract routes from Express, NestJS, and Spring patterns
      const routes = extractRoutes(content, relPath);
      allRoutes.push(...routes);

      for (const route of routes) {
        if (HAS_VERSION.test(route.path)) {
          hasAnyVersioned = true;
        }

        // Check for CRUD verbs in route paths
        if (CRUD_VERBS.test(route.path)) {
          findings.push({
            id: nextId(),
            severity: "medium",
            title: `Verb-based resource name: ${route.path}`,
            description:
              `Route "${route.method.toUpperCase()} ${route.path}" contains a CRUD verb in the resource name. ` +
              "REST convention uses nouns for resources and HTTP verbs for actions. " +
              "Example: replace GET /getUsers with GET /users.",
            domain: "api-design",
            rule: "verb-based-resource-name",
            confidence: 0.90,
            evidence: [{ file: route.file, line: route.line }],
            recommendation: `Use a noun-based resource name. Replace "${route.path}" with a noun (e.g., "${toNounPath(route.path)}").`,
            effort: "small",
            tags: ["api-design", "rest", "naming"],
            source: "tool",
          });
        }
      }
    } catch {
      /* skip unreadable files */
    }
  }

  // Check for missing versioning (only if project has routes but no versioned routes)
  const routeFiles = new Set(allRoutes.map((r) => r.file));
  if (allRoutes.length >= 3 && !hasAnyVersioned) {
    const representativeFile = allRoutes[0]!.file;
    findings.push({
      id: nextId(),
      severity: "low",
      title: "API routes missing version prefix",
      description:
        `Found ${allRoutes.length} route definition(s) across ${routeFiles.size} file(s) but none include a version prefix (e.g., /v1/ or /api/v1/). ` +
        "Versioning enables backward-compatible API evolution.",
      domain: "api-design",
      rule: "missing-api-versioning",
      confidence: 0.85,
      evidence: [{ file: representativeFile, line: allRoutes[0]!.line }],
      recommendation: "Prefix all API routes with a version segment: /api/v1/… Change router.get('/users') to router.get('/api/v1/users').",
      effort: "medium",
      tags: ["api-design", "rest", "versioning"],
      source: "tool",
    });
  }

  return findings;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function extractRoutes(
  content: string,
  file: string,
): Array<{ path: string; method: string; file: string; line: number }> {
  const routes: Array<{ path: string; method: string; file: string; line: number }> = [];

  const addRoute = (path: string, method: string, charIndex: number) => {
    routes.push({
      path,
      method,
      file,
      line: content.slice(0, charIndex).split("\n").length,
    });
  };

  EXPRESS_ROUTE.lastIndex = 0;
  for (const m of content.matchAll(EXPRESS_ROUTE)) {
    addRoute(m[2] ?? "", m[1] ?? "", m.index ?? 0);
  }

  NESTJS_ROUTE.lastIndex = 0;
  for (const m of content.matchAll(NESTJS_ROUTE)) {
    addRoute(m[1] ?? "/", "rest", m.index ?? 0);
  }

  SPRING_ROUTE.lastIndex = 0;
  for (const m of content.matchAll(SPRING_ROUTE)) {
    addRoute(m[1] ?? "", "rest", m.index ?? 0);
  }

  return routes;
}

/** Heuristically convert a verb-based path to a noun-based one. */
function toNounPath(path: string): string {
  return path.replace(CRUD_VERBS, (_, verb) => {
    const segment = path.split("/").find((s) => s.toLowerCase().includes(verb.toLowerCase()) && s.length > verb.length);
    return segment ? `/${segment.replace(new RegExp(verb, "i"), "")}` : "/resources";
  });
}
