import type { Route, RouteExtractor } from "./types.js";

function lineAt(content: string, charIndex: number): number {
  return content.slice(0, charIndex).split("\n").length;
}

// ─── Express / Hapi.js ───────────────────────────────────────────────────────

const EXPRESS_ROUTE =
  /(?:router|app)\.(get|post|put|patch|delete|head)\s*\(\s*["'`]([^"'`]+)["'`]/gi;

const expressExtractor: RouteExtractor = {
  extractRoutes(content, file) {
    const routes: Route[] = [];
    EXPRESS_ROUTE.lastIndex = 0;
    for (const m of content.matchAll(EXPRESS_ROUTE)) {
      routes.push({ path: m[2] ?? "", method: m[1] ?? "", file, line: lineAt(content, m.index ?? 0) });
    }
    return routes;
  },
};

// ─── NestJS ──────────────────────────────────────────────────────────────────

const NESTJS_ROUTE =
  /@(?:Get|Post|Put|Patch|Delete)\s*\(\s*["'`]([^"'`]*)["'`]\s*\)/gi;

const nestjsExtractor: RouteExtractor = {
  extractRoutes(content, file) {
    const routes: Route[] = [];
    NESTJS_ROUTE.lastIndex = 0;
    for (const m of content.matchAll(NESTJS_ROUTE)) {
      routes.push({ path: m[1] ?? "/", method: "rest", file, line: lineAt(content, m.index ?? 0) });
    }
    return routes;
  },
};

// ─── Spring MVC ──────────────────────────────────────────────────────────────

const SPRING_ROUTE =
  /@(?:GetMapping|PostMapping|PutMapping|DeleteMapping|PatchMapping|RequestMapping)\s*\(\s*(?:value\s*=\s*)?["'']([^"'']+)["'']/gi;

const springExtractor: RouteExtractor = {
  extractRoutes(content, file) {
    const routes: Route[] = [];
    SPRING_ROUTE.lastIndex = 0;
    for (const m of content.matchAll(SPRING_ROUTE)) {
      routes.push({ path: m[1] ?? "", method: "rest", file, line: lineAt(content, m.index ?? 0) });
    }
    return routes;
  },
};

// ─── Registry ────────────────────────────────────────────────────────────────

const ALL_EXTRACTORS: ReadonlyArray<RouteExtractor> = [
  expressExtractor,
  nestjsExtractor,
  springExtractor,
];

export function getAllRouteExtractors(): ReadonlyArray<RouteExtractor> {
  return ALL_EXTRACTORS;
}
