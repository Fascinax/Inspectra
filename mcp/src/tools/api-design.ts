import { readFile } from "node:fs/promises";
import { relative, extname } from "node:path";
import type { Finding } from "../types.js";
import { collectSourceFiles } from "../utils/files.js";
import { createIdSequence } from "../utils/id.js";
import { getAllRouteExtractors } from "../strategies/route-extractors.js";
import type { Route } from "../strategies/types.js";

// ─── Patterns ───────────────────────────────────────────────────────────────────────

/** CRUD verb list that should NOT appear in resource names */
const CRUD_VERBS = /\/(get|create|add|delete|remove|update|edit|fetch|retrieve|list|find)(?=[A-Z_\-/]|$)/i;

/** Check if the path has a version segment (/v1/, /v2/, /api/v1/, etc) */
const HAS_VERSION = /\/(?:api\/)?v\d+\//i;

/** Detects non-kebab-case segments: camelCase, PascalCase, or snake_case in path segments */
const NON_KEBAB_SEGMENT = /[a-z][A-Z]|[A-Z]{2}|_/;

/** HttpSession usage in REST controllers — stateful breach */
const HTTP_SESSION_USAGE =
  /HttpSession\s+\w+|HttpServletRequest\s+\w+.*\.getSession|@SessionAttributes\b/;

/** Controller returns raw List/Collection without pagination wrapper */
const LIST_RETURN_TYPE =
  /(?:ResponseEntity<\s*)?(?:List|Collection|Set)<[^>]+>\s*>\s*\w+\s*\(|(?:public|protected)\s+(?:List|Collection|Set)<[^>]+>\s+\w+\s*\(/;
const PAGEABLE_PARAM = /Pageable\b|Page<|PageRequest\b|Slice<|@PageableDefault\b/;

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
  const allRoutes: Route[] = [];
  let hasAnyVersioned = false;

  for (const filePath of files) {
    try {
      const content = await readFile(filePath, "utf-8");
      const relPath = relative(projectDir, filePath);

      // Extract routes from Express, NestJS, and Spring patterns
      const routes = extractRoutes(content, relPath);
      allRoutes.push(...routes);

      // Check for HttpSession usage in REST controllers
      if (HTTP_SESSION_USAGE.test(content) && /@(?:RestController|Controller)\b/.test(content)) {
        const sessionLine = content.split("\n").findIndex((l) => HTTP_SESSION_USAGE.test(l));
        findings.push({
          id: nextId(),
          severity: "high",
          title: `HttpSession used in REST controller: ${relPath}`,
          description:
            "A REST controller injects HttpSession or calls getSession(). REST APIs should be stateless — " +
            "using server-side sessions breaks horizontal scalability and requires sticky sessions for load balancing.",
          domain: "api-design",
          rule: "stateful-rest-controller",
          confidence: 0.90,
          evidence: [{ file: relPath, line: sessionLine >= 0 ? sessionLine + 1 : 1 }],
          recommendation:
            "Replace session usage with stateless authentication (JWT, OAuth2 tokens). " +
            "Store user context in the token payload, not the server session.",
          effort: "large",
          tags: ["api-design", "rest", "stateless", "scalability"],
          source: "tool",
        });
      }

      // Check for List return types without pagination in controllers
      if (/@(?:RestController|Controller)\b/.test(content) && LIST_RETURN_TYPE.test(content) && !PAGEABLE_PARAM.test(content)) {
        const listLine = content.split("\n").findIndex((l) => LIST_RETURN_TYPE.test(l));
        findings.push({
          id: nextId(),
          severity: "medium",
          title: `Unpaginated list endpoint: ${relPath}`,
          description:
            "A controller returns List/Collection without pagination (no Pageable parameter or Page return type). " +
            "With growing data, this causes memory spikes and slow responses.",
          domain: "api-design",
          rule: "unpaginated-list-endpoint",
          confidence: 0.80,
          evidence: [{ file: relPath, line: listLine >= 0 ? listLine + 1 : 1 }],
          recommendation:
            "Accept a Pageable parameter and return Page<T> instead of List<T>. " +
            "Example: Page<UserDTO> getUsers(Pageable pageable)",
          effort: "medium",
          tags: ["api-design", "rest", "pagination", "performance"],
          source: "tool",
        });
      }

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

        // Check for non-kebab-case path segments (camelCase, PascalCase, snake_case)
        const segments = route.path.split("/").filter((s) => s && !s.startsWith(":") && !s.startsWith("{"));
        for (const seg of segments) {
          if (NON_KEBAB_SEGMENT.test(seg)) {
            findings.push({
              id: nextId(),
              severity: "low",
              title: `Non-kebab-case path segment: "${seg}"`,
              description:
                `Route "${route.method.toUpperCase()} ${route.path}" contains a non-kebab-case segment "${seg}". ` +
                "REST convention uses lowercase kebab-case for URL segments (e.g., /user-profiles instead of /userProfiles).",
              domain: "api-design",
              rule: "non-kebab-case-path",
              confidence: 0.85,
              evidence: [{ file: route.file, line: route.line }],
              recommendation: `Rename "${seg}" to "${toKebab(seg)}".`,
              effort: "small",
              tags: ["api-design", "rest", "naming"],
              source: "tool",
            });
            break; // One finding per route is enough
          }
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

function extractRoutes(content: string, file: string): Route[] {
  return getAllRouteExtractors().flatMap((e) => e.extractRoutes(content, file));
}

/** Heuristically convert a verb-based path to a noun-based one. */
function toNounPath(path: string): string {
  return path.replace(CRUD_VERBS, (_, verb) => {
    const segment = path.split("/").find((s) => s.toLowerCase().includes(verb.toLowerCase()) && s.length > verb.length);
    return segment ? `/${segment.replace(new RegExp(verb, "i"), "")}` : "/resources";
  });
}

/** Convert camelCase/PascalCase/snake_case to kebab-case. */
function toKebab(segment: string): string {
  return segment
    .replace(/_/g, "-")
    .replace(/([a-z])([A-Z])/g, "$1-$2")
    .replace(/([A-Z]+)([A-Z][a-z])/g, "$1-$2")
    .toLowerCase();
}
