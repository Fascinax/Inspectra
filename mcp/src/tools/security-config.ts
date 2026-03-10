import { readFile } from "node:fs/promises";
import { join, relative, extname, basename } from "node:path";
import type { Finding } from "../types.js";
import { collectSourceFiles, collectAllFiles } from "../utils/files.js";
import { createIdSequence } from "../utils/id.js";
import { logger } from "../logger.js";

const JAVA_EXTENSIONS = [".java"];
const CONFIG_EXTENSIONS = [".properties", ".yml", ".yaml"];

// ─── Spring Security Misconfiguration Patterns ──────────────────────────────

const PERMIT_ALL_PATTERN = /\.anyRequest\s*\(\s*\)\s*\.permitAll\s*\(\s*\)/;
const CSRF_DISABLE_PATTERN = /\.csrf\s*\(\s*(?:AbstractHttpConfigurer::disable|\)?\s*\.disable\s*\(\s*\))/;
const CORS_WILDCARD_ORIGIN = /(?:setAllowedOrigins?|addAllowedOrigin|allowedOrigins)\s*\([^)]*["']\*["'][^)]*\)/;
const CORS_ALLOW_CREDENTIALS = /(?:setAllowCredentials|allowCredentials)\s*\(\s*true\s*\)/;

// ─── Commented-Out Auth Annotations ─────────────────────────────────────────

const COMMENTED_AUTH_ANNOTATION =
  /\/\/\s*@(?:PreAuthorize|Secured|RolesAllowed)\s*\(/;

// ─── Missing @Valid Detection ───────────────────────────────────────────────

const REQUEST_BODY_PARAM =
  /(?:@RequestBody)\s+(?:(?:final|Optional<)\s*)?(\w+)/g;
const VALID_BEFORE_REQUEST_BODY =
  /@Valid\s+@RequestBody|@Validated\s+@RequestBody/;

// ─── Actuator Exposure ──────────────────────────────────────────────────────

const ACTUATOR_EXPOSE_ALL =
  /management\.endpoints\.web\.exposure\.include\s*=\s*\*/;

/**
 * Scans a project for framework-level security misconfigurations.
 *
 * Detects:
 * - Spring Security `anyRequest().permitAll()` and `csrf().disable()`
 * - Commented-out `@PreAuthorize` / `@Secured` / `@RolesAllowed`
 * - CORS wildcard origin (`*`) combined with `allowCredentials(true)`
 * - Missing `@Valid` on `@RequestBody` parameters
 * - Actuator endpoints exposed without authentication
 */
export async function checkSecurityConfig(
  projectDir: string,
  ignoreDirs?: string[],
): Promise<Finding[]> {
  const findings: Finding[] = [];
  const nextId = createIdSequence("SEC", 400);

  const javaFiles = await collectSourceFiles(projectDir, JAVA_EXTENSIONS, ignoreDirs);
  const allFiles = await collectAllFiles(projectDir, ignoreDirs);
  const configFiles = allFiles.filter((f) => CONFIG_EXTENSIONS.includes(extname(f)));

  // ── Phase 1: Spring Security class-level misconfigs ──────────────────
  for (const filePath of javaFiles) {
    try {
      const content = await readFile(filePath, "utf-8");
      const relPath = relative(projectDir, filePath);
      const lines = content.split("\n");

      checkPermitAll(content, lines, relPath, findings, nextId);
      checkCsrfDisabled(content, lines, relPath, findings, nextId);
      checkCommentedAuthAnnotations(lines, relPath, findings, nextId);
      checkCorsWildcard(content, lines, relPath, findings, nextId);
      checkMissingValid(content, lines, relPath, findings, nextId);
    } catch (err) {
      logger.warn("checkSecurityConfig: could not read file", { file: filePath, error: String(err) });
    }
  }

  // ── Phase 2: Config-level issues ─────────────────────────────────────
  for (const filePath of configFiles) {
    try {
      const content = await readFile(filePath, "utf-8");
      const relPath = relative(projectDir, filePath);
      const lines = content.split("\n");

      checkActuatorExposure(content, lines, relPath, findings, nextId);
    } catch (err) {
      logger.warn("checkSecurityConfig: could not read config", { file: filePath, error: String(err) });
    }
  }

  return findings;
}

// ─── Detection functions ────────────────────────────────────────────────────

function checkPermitAll(
  content: string,
  lines: string[],
  relPath: string,
  findings: Finding[],
  nextId: () => string,
): void {
  if (!PERMIT_ALL_PATTERN.test(content)) return;

  const line = findLineNumber(lines, PERMIT_ALL_PATTERN);
  findings.push({
    id: nextId(),
    severity: "critical",
    title: "All requests permitted without authentication",
    description:
      "Spring Security is configured with anyRequest().permitAll(), effectively disabling authentication for all endpoints. " +
      "Any client can access any endpoint without credentials.",
    domain: "security",
    rule: "no-permit-all",
    confidence: 0.95,
    evidence: [{ file: relPath, line }],
    recommendation:
      "Replace .anyRequest().permitAll() with specific matchers: " +
      "e.g. .requestMatchers(\"/public/**\").permitAll().anyRequest().authenticated()",
    effort: "medium",
    tags: ["owasp:A01", "CWE-862", "spring-security", "authentication"],
    source: "tool",
  });
}

function checkCsrfDisabled(
  content: string,
  lines: string[],
  relPath: string,
  findings: Finding[],
  nextId: () => string,
): void {
  if (!CSRF_DISABLE_PATTERN.test(content)) return;

  const line = findLineNumber(lines, /\.csrf/);
  findings.push({
    id: nextId(),
    severity: "high",
    title: "CSRF protection is disabled",
    description:
      "Spring Security CSRF protection is explicitly disabled. " +
      "This exposes the application to cross-site request forgery attacks unless the API is purely stateless with token-based auth.",
    domain: "security",
    rule: "no-csrf-disable",
    confidence: 0.90,
    evidence: [{ file: relPath, line }],
    recommendation:
      "If the API uses session-based auth or cookies, re-enable CSRF. " +
      "If purely stateless with JWT/Bearer tokens and no cookies, CSRF disable may be acceptable — add a comment documenting the rationale.",
    effort: "small",
    tags: ["owasp:A01", "CWE-352", "spring-security", "csrf"],
    source: "tool",
  });
}

function checkCommentedAuthAnnotations(
  lines: string[],
  relPath: string,
  findings: Finding[],
  nextId: () => string,
): void {
  for (let i = 0; i < lines.length; i++) {
    if (COMMENTED_AUTH_ANNOTATION.test(lines[i]!)) {
      findings.push({
        id: nextId(),
        severity: "high",
        title: "Authentication annotation is commented out",
        description:
          "A @PreAuthorize, @Secured, or @RolesAllowed annotation is commented out, " +
          "leaving the endpoint unprotected. This is likely a development shortcut that was not reverted.",
        domain: "security",
        rule: "no-commented-auth",
        confidence: 0.92,
        evidence: [{ file: relPath, line: i + 1, snippet: lines[i]!.trim().substring(0, 120) }],
        recommendation:
          "Uncomment the security annotation or replace it with the intended access control. " +
          "Never commit security bypasses.",
        effort: "small",
        tags: ["owasp:A01", "CWE-862", "spring-security", "authorization"],
        source: "tool",
      });
    }
  }
}

function checkCorsWildcard(
  content: string,
  lines: string[],
  relPath: string,
  findings: Finding[],
  nextId: () => string,
): void {
  const hasWildcard = CORS_WILDCARD_ORIGIN.test(content);
  const hasCredentials = CORS_ALLOW_CREDENTIALS.test(content);

  if (hasWildcard && hasCredentials) {
    const line = findLineNumber(lines, CORS_WILDCARD_ORIGIN);
    findings.push({
      id: nextId(),
      severity: "high",
      title: "CORS allows wildcard origin with credentials",
      description:
        "CORS is configured to allow origin '*' together with allowCredentials(true). " +
        "Modern browsers block this combination, but misconfigured proxies or older clients may still honor it, " +
        "enabling credential theft via cross-origin requests.",
      domain: "security",
      rule: "no-cors-wildcard-credentials",
      confidence: 0.92,
      evidence: [{ file: relPath, line }],
      recommendation:
        "Replace the wildcard origin with an explicit allowlist of trusted origins. " +
        "Use an environment variable to configure allowed origins per environment.",
      effort: "small",
      tags: ["owasp:A01", "CWE-942", "cors", "credentials"],
      source: "tool",
    });
  } else if (hasWildcard) {
    const line = findLineNumber(lines, CORS_WILDCARD_ORIGIN);
    findings.push({
      id: nextId(),
      severity: "medium",
      title: "CORS allows wildcard origin",
      description:
        "CORS is configured with origin '*'. While acceptable for fully public APIs, " +
        "this is risky for APIs that handle any form of session or authentication.",
      domain: "security",
      rule: "cors-wildcard-origin",
      confidence: 0.85,
      evidence: [{ file: relPath, line }],
      recommendation:
        "Restrict allowed origins to known frontend URLs. Use an environment variable for per-environment configuration.",
      effort: "small",
      tags: ["owasp:A05", "CWE-942", "cors"],
      source: "tool",
    });
  }
}

function checkMissingValid(
  content: string,
  lines: string[],
  relPath: string,
  findings: Finding[],
  nextId: () => string,
): void {
  // Only check controller files
  if (!/@(?:RestController|Controller)\b/.test(content)) return;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]!;
    // Look for @RequestBody without @Valid/@Validated on the same or preceding token
    if (/@RequestBody\b/.test(line) && !VALID_BEFORE_REQUEST_BODY.test(line)) {
      // Check the preceding few characters/tokens on the same line for @Valid
      const beforeRequestBody = line.substring(0, line.indexOf("@RequestBody"));
      if (!/@Valid\b/.test(beforeRequestBody) && !/@Validated\b/.test(beforeRequestBody)) {
        findings.push({
          id: nextId(),
          severity: "medium",
          title: "Missing @Valid on @RequestBody parameter",
          description:
            "A @RequestBody parameter lacks @Valid or @Validated annotation. " +
            "Without it, Bean Validation constraints on the DTO are silently ignored, " +
            "allowing malformed input to reach the service layer.",
          domain: "security",
          rule: "missing-valid-annotation",
          confidence: 0.88,
          evidence: [{ file: relPath, line: i + 1, snippet: line.trim().substring(0, 120) }],
          recommendation:
            "Add @Valid before @RequestBody: " +
            "public ResponseEntity<?> create(@Valid @RequestBody MyDTO dto)",
          effort: "small",
          tags: ["owasp:A03", "CWE-20", "input-validation", "spring"],
          source: "tool",
        });
      }
    }
  }
}

function checkActuatorExposure(
  content: string,
  lines: string[],
  relPath: string,
  findings: Finding[],
  nextId: () => string,
): void {
  if (!ACTUATOR_EXPOSE_ALL.test(content)) return;

  const line = findLineNumber(lines, ACTUATOR_EXPOSE_ALL);
  findings.push({
    id: nextId(),
    severity: "medium",
    title: "All Actuator endpoints exposed",
    description:
      "management.endpoints.web.exposure.include=* exposes all Spring Boot Actuator endpoints, " +
      "including sensitive ones like /env, /configprops, /heapdump, and /shutdown. " +
      "Without authentication, this is an information leak.",
    domain: "security",
    rule: "actuator-expose-all",
    confidence: 0.90,
    evidence: [{ file: relPath, line }],
    recommendation:
      "Limit exposure to safe endpoints: management.endpoints.web.exposure.include=health,info,prometheus. " +
      "If broader exposure is needed, ensure Spring Security protects the management port.",
    effort: "small",
    tags: ["owasp:A05", "CWE-200", "spring-boot", "actuator"],
    source: "tool",
  });
}

// ─── Utility ────────────────────────────────────────────────────────────────

function findLineNumber(lines: string[], pattern: RegExp): number {
  for (let i = 0; i < lines.length; i++) {
    if (pattern.test(lines[i]!)) return i + 1;
  }
  return 1;
}
