# API Design Audit — Reference Material

> This file is the authoritative reference companion for the `audit-api-design` agent.
> It contains REST principles, rule catalogs, error contracts, OpenAPI quality rules, and detection strategies.
> The agent file (`.github/agents/audit-api-design.agent.md`) points here for full details.
> Detailed raw rule catalogs: `api-design-rules.md` (REST) and `openapi-quality-rules.md` (OpenAPI).

---

## External References

### Primary Specifications

| Source | Author / Org | Year | URL |
| -------- | ------------- | ------ | ----- |
| Architectural Styles and the Design of Network-based Software Architectures (Ch. 5) | Roy T. Fielding (UC Irvine) | 2000 | <https://ics.uci.edu/~fielding/pubs/dissertation/rest_arch_style.htm> |
| Microsoft REST API Guidelines | Microsoft | 2024 | <https://github.com/microsoft/api-guidelines> |
| JSON:API Specification v1.1 | JSON:API contributors | 2022 | <https://jsonapi.org/format/> |
| Google API Design Guide | Google Cloud | 2024 | <https://cloud.google.com/apis/design> |
| OpenAPI Specification 3.1.0 | OpenAPI Initiative | 2021 | <https://spec.openapis.org/oas/v3.1.0> |
| RFC 9457 — Problem Details for HTTP APIs (obsoletes RFC 7807) | Nottingham, Wilde, Dalal (IETF) | 2023 | <https://www.rfc-editor.org/rfc/rfc9457> |
| RFC 7231 — HTTP/1.1 Semantics and Content | Fielding, Reschke (IETF) | 2014 | <https://www.rfc-editor.org/rfc/rfc7231> |
| RFC 7235 — Hypertext Transfer Protocol (HTTP/1.1): Authentication | IETF | 2014 | <https://www.rfc-editor.org/rfc/rfc7235> |
| RFC 8594 — The Sunset HTTP Header Field | Wilde (IETF) | 2019 | <https://www.rfc-editor.org/rfc/rfc8594> |

### Community & Industry Guides

| Source | Maintainer | URL |
| -------- | ----------- | ----- |
| Zalando RESTful API Guidelines | Zalando SE | <https://opensource.zalando.com/restful-api-guidelines/> |
| Stripe API Reference | Stripe | <https://stripe.com/docs/api> |
| GitHub REST API Docs | GitHub | <https://docs.github.com/en/rest> |
| Spectral OAS Ruleset | Stoplight | <https://docs.stoplight.io/docs/spectral/4dec24461f3af-open-api-rules> |
| Stoplight API Design Guide | Stoplight | <https://stoplight.io/api-design-guide/basics> |
| OWASP API Security Top 10 (2023) | OWASP | <https://owasp.org/API-Security/editions/2023/en/0x11-t10/> |

### Research

| Source | Key Finding | URL |
| -------- | ------------- | ----- |
| Fielding Dissertation §5 | 6 REST constraints; HATEOAS as "hypermedia as the engine of application state" | <https://ics.uci.edu/~fielding/pubs/dissertation/rest_arch_style.htm#sec_5_1> |
| Microsoft API Guidelines §12 | URL path versioning recommended over query-param versioning | <https://github.com/microsoft/api-guidelines/blob/vNext/azure/Guidelines.md#api-versioning> |
| OWASP API8:2023 | Security misconfiguration — stack trace exposure in error responses | <https://owasp.org/API-Security/editions/2023/en/0xa8-security-misconfiguration/> |

---

## REST Architectural Constraints (Fielding 2000)

| Constraint | What it Requires | Common Violations |
| ---------- | ---------------- | ----------------- |
| **Client-Server** | Clear separation of concerns — UI from data storage | Tight coupling between client-specific logic and API shape |
| **Stateless** | Each request is self-contained — no server-side session | Session state stored on server; requiring cookie/session for API calls |
| **Cacheable** | Responses must declare cacheability | Missing `Cache-Control`, `ETag`, `Last-Modified` on GET responses |
| **Uniform Interface** | Consistent resource identification + self-descriptive messages | Verb-in-path, inconsistent naming, missing `Content-Type` |
| **Layered System** | Client cannot tell if it's connected to origin or intermediary | CORS not configured, missing proxy-compatible headers |
| **Code on Demand** | (Optional) Server can send executable code to client | Rarely applied in modern REST — not typically audited |

---

## URL / Resource Naming Rules

Source: Fielding §5.2.1, Microsoft API Guidelines §7, Google API Design Guide

### Rules Table (tool-detectable)

| Rule | Inspectra ID | Severity | Detection Regex |
| ----- | ------------ | -------- | --------------- |
| CRUD verb in path (`/createUser`, `/getOrder`) | `API-001` | `high` | `(?i)/(create\|get\|fetch\|delete\|update\|list\|add\|remove\|edit\|save\|search\|find\|retrieve\|process)[/-]` |
| Singular collection name (`/user` not `/users`) | `API-002` | `medium` | `(?i)/(user\|order\|product\|account\|payment\|customer\|invoice)(/\{` |
| Snake_case or camelCase in path segment | `API-003` | `medium` | `(?<=/)[a-z]+[_][a-z]` or `(?<=/)[a-z][a-z]*[A-Z]` in route strings |
| File extension in URL (`.json`, `.xml`) | `API-004` | `medium` | `(?i)/[^/?#]+\.(json\|xml\|html\|csv\|pdf)\b` |
| Version embedded mid-path (`/users/v2/`) | `API-005` | `high` | `/[a-z][a-z0-9_-]+/v\d+/` (not at start) |
| Deeply nested path (> 3 resources) | `API-006` | `low` | Count `/` segments — flag ≥ 6 |
| Missing API version entirely | `API-007` | `critical` | No `/v\d+/` prefix AND no versioning middleware detected |
| API version in query param (`?api-version=1`) | `API-008` | `medium` | `[?&](api[-_]?version\|version\|ver)=\d` |

### Key Principle

> Resource paths identify **things** (nouns), not **actions** (verbs). The HTTP method is the verb.
> ✅ `POST /orders` — create an order.  
> ❌ `POST /createOrder` — CRUD verb in path.

---

## HTTP Method Semantics

Source: RFC 7231, Fielding §5.1.5, Microsoft API Guidelines §8

| Method | Safe? | Idempotent? | Correct Use | Common Violations |
| ------- | ----- | ----------- | ----------- | ----------------- |
| **GET** | Yes | Yes | Read resource; no side effects | Handler calls `save()`, `update()`, performs DB write |
| **POST** | No | No | Create resource (non-idempotent) | Used for idempotent upserts without `Idempotency-Key` |
| **PUT** | No | Yes | Full resource replacement | Used for partial update — should be `PATCH` |
| **PATCH** | No | No | Partial update | Used for full replacement |
| **DELETE** | No | Yes | Remove resource; second call → 204 or 404 | Throws 500 when resource already deleted |
| **HEAD** | Yes | Yes | Same as GET, no body | Missing on resources that support GET |

### LLM-Detection Heuristics

| Rule | Signal to read |
| ----- | -------------- |
| GET with side effects | GET-mapped handlers calling `save()`, `update()`, `insert()`, `delete()` with no read-replica guard |
| PUT used for partial update | PUT handlers using `Object.assign(existing, dto)`, `...spread`, `partial: true`, `omitUndefined` |
| DELETE not idempotent | DELETE throwing 500 when resource not found instead of returning 204/404 |

---

## HTTP Status Code Rules

Source: RFC 7231, JSON:API v1.1, Microsoft API Guidelines §8.5

| Rule | Inspectra ID | Correct Code | Wrong Code | Severity |
| ----- | ------------ | ------------ | ---------- | -------- |
| Resource creation | `API-011` | `201 Created` (+ `Location` header) | `200 OK` | `high` |
| Successful DELETE with no body | `API-012` | `204 No Content` | `200 OK` | `medium` |
| Validation failure (semantic) | `API-013` | `422 Unprocessable Entity` | `400 Bad Request` | `medium` |
| Permanently removed resource | `API-014` | `410 Gone` | `404 Not Found` | `low` |
| Client input error in catch-all | `API-015` | `400`/`422` | `500 Internal` | `critical` |
| Not authenticated | `API-016` | `401 Unauthorized` | `403 Forbidden` | `high` |
| Authenticated but no permission | `API-017` | `403 Forbidden` | `401 Unauthorized` | `high` |
| Error in body of `200 OK` | `API-018` | Correct 4xx/5xx code | `200 { error: true }` | `critical` |

---

## Error Response Contract — RFC 9457 Problem Details

Source: RFC 9457 (obsoletes RFC 7807), Microsoft API Guidelines §8.7

### Required Fields

```json
{
  "type":     "https://example.com/errors/validation-failed",
  "title":    "Validation Failed",
  "status":   422,
  "detail":   "The 'email' field must be a valid email address.",
  "instance": "/errors/b5e2e8f1-4a3c-4d2e-9f1a-3b6c7d8e9f0a"
}
```

| Field | Required? | Purpose |
| ----- | --------- | ------- |
| `type` | SHOULD | URI identifying the error type (stable, documentable) |
| `title` | SHOULD | Short human-readable summary (same for all instances of type) |
| `status` | SHOULD | HTTP status code (mirrors response code) |
| `detail` | MAY | Human-readable, instance-specific explanation |
| `instance` | MAY | URI for this specific occurrence (useful for support) |

**Media type**: `Content-Type: application/problem+json`

### Error Contract Antipatterns

| Antipattern | Inspectra ID | Severity | Detection Signal |
| ----------- | ------------ | -------- | ---------------- |
| Raw string message only `{ "message": "..." }` | `API-501` | `high` | No `type`/`status` fields in error response shape |
| Stack trace exposed in response body | `API-502` | `critical` | `err.stack`, `err.message` native, SQL text, ORM trace in response |
| `200 OK` with `{ "error": true }` body | `API-503` | `critical` | `res.status(200)` + error payload; regex: `status(200).*error.*true` |
| Inconsistent error schemas across endpoints | `API-504` | `high` | Multiple error shapes: `{ error }`, `{ message }`, `{ errors: [] }` mixed |
| Missing `type` URI — non-dereferenceable | `API-505` | `medium` | `type` field is `"about:blank"` or absent |
| 500 returned for client input validation error | `API-506` | `critical` | Global catch handler: `catch(e) { res.status(500) }` without input-error discrimination |

---

## Pagination Patterns

Source: Zalando RESTful API Guidelines, GitHub REST API, Stripe API, Microsoft API Guidelines

### Pagination Antipatterns

| Antipattern | Inspectra ID | Severity | Detection Signal |
| ----------- | ------------ | -------- | ---------------- |
| List endpoint returns unbounded results | `API-521` | `high` | Collection endpoint: no `limit`, `pageSize`, `perPage`, or cursor param accepted |
| Missing pagination metadata | `API-522` | `medium` | Response has array data but no `total`, `count`, `next`, `prev`, or `Link` header |
| Offset pagination on large datasets | `API-523` | `medium` | `offset`/`skip` params present on endpoints likely to have > 10k rows |
| Inconsistent pagination param names | `API-524` | `low` | Mixed `page`, `offset`, `start`, `from` across different collection endpoints |

### Recommended Patterns

```markdown
# Offset pagination (small datasets)
GET /orders?page=2&pageSize=20
→ { "data": [...], "total": 500, "page": 2, "pageSize": 20 }

# Cursor pagination (large datasets — Stripe/GitHub style)
GET /events?after=evt_abc123&limit=25
→ { "data": [...], "hasMore": true, "nextCursor": "evt_xyz789" }

# Link header (GitHub style — RFC 5988)
Link: <https://api.example.com/orders?page=3>; rel="next",
      <https://api.example.com/orders?page=1>; rel="prev"
```

---

## OpenAPI Completeness Rules

Source: OpenAPI 3.1.0 spec, Spectral OAS ruleset, Stoplight API Design Guide

### Critical Completeness Checks

| Rule | Inspectra ID | Severity | Spectral Rule ID | Detection |
| ----- | ------------ | -------- | ---------------- | --------- |
| Missing `operationId` on any operation | `API-031` | `high` | `operation-operationId` | PARSE |
| Missing `summary` or `description` | `API-032` | `medium` | `operation-description` | PARSE |
| Missing request body `schema` | `API-033` | `high` | `oas3-schema` | PARSE |
| Missing response schema on 200/201 | `API-034` | `high` | `operation-success-response` | PARSE |
| No error responses (no 4xx/5xx defined) | `API-035` | `high` | custom | PARSE |
| Inline `type: object` instead of `$ref` | `API-036` | `medium` | `oas3-unused-component` | HYBRID |
| Path param without `required: true` | `API-037` | `critical` | `path-params` | PARSE |
| Query param with no `description` | `API-038` | `low` | `oas3-parameter-description` | PARSE |
| No `securitySchemes` in `components` | `API-039` | `high` | custom | PARSE |
| Mutation endpoint (POST/PUT/PATCH/DELETE) without `security` | `API-040` | `high` | custom | PARSE |
| No `servers` array defined | `API-041` | `medium` | `oas3-api-servers` | PARSE |
| Missing `example` on request/response schemas | `API-042` | `low` | `oas3-valid-schema-example-in-...` | PARSE |
| `operationId` not following `verbNoun` pattern | `API-043` | `low` | custom | SEMANTIC |
| Inconsistent tag names (singular/plural mixed) | `API-044` | `low` | custom | SEMANTIC |

### `operationId` Convention

```yaml
# ✅ verbNoun pattern — code generators produce readable method names
operationId: createUser
operationId: listOrders
operationId: getUserById
operationId: deleteInvoice

# ❌ path-derived fallback (generator default when missing)
# postUsersPost, getUsersIdOrdersGet
```

---

## Versioning Antipatterns

Source: Microsoft API Guidelines §12, Google API Design Guide, Zalando [116][117]

| Antipattern | Inspectra ID | Severity | Signal |
| ----------- | ------------ | -------- | ------ |
| No version in URL or headers | `API-007` | `critical` | No `/v\d+/` prefix in any route definition |
| Version in query param (`?api-version=`) | `API-008` | `medium` | Query param versioning detected |
| Version embedded mid-path (`/users/v2/`) | `API-005` | `high` | `/[a-z]+/v\d+/` after first segment |
| Breaking change without version bump | `API-551` | `critical` | Field removal or type change in same version prefix (LLM: git diff comparison) |
| No `Sunset` header on deprecated version | `API-552` | `medium` | Deprecated annotation but no `Sunset`/`Deprecation` middleware |

---

## Security Rules

Source: OWASP API Security Top 10 (2023), Microsoft API Guidelines, OpenAPI 3.1.0

| Rule | Inspectra ID | Severity | Signal |
| ----- | ------------ | -------- | ------ |
| Mutation endpoint lacks authentication | `API-041` | `critical` | POST/PUT/PATCH/DELETE route with no auth middleware check |
| PII in URL (email, SSN, tokens) | `API-042` | `high` | Email pattern `[^@]+@[^@]+` or `/ssn/`, `/token/` in path templates |
| CORS wildcard on non-public mutation endpoint | `API-043` | `high` | `Access-Control-Allow-Origin: *` on non-GET endpoints |
| No `X-RateLimit-*` headers documented | `API-044` | `medium` | No rate-limit headers in OpenAPI responses or middleware |
| Missing `/health` or `/status` endpoint | `API-045` | `low` | No health/ping endpoint in route tree |

---

## Inspectra Rule Mapping

### Phase 1 — Tool-Detected (source: "tool", confidence ≥ 0.8, IDs 001–499)

| ID Range | Category | Tool |
| --------- | -------- | ---- |
| `API-001–010` | URL/resource naming violations | `inspectra_check_rest_conventions` |
| `API-011–020` | HTTP status code violations | `inspectra_check_rest_conventions` |
| `API-021–030` | HTTP method semantic violations | `inspectra_check_rest_conventions` |
| `API-031–050` | OpenAPI spec completeness | `inspectra_check_rest_conventions` |
| `API-051–099` | Versioning structural violations | `inspectra_check_rest_conventions` |

### Phase 2 — LLM-Detected (source: "llm", confidence ≤ 0.7, IDs 501+)

| ID | Rule | Severity |
| ---- | ----- | -------- |
| `API-501` | Error response lacks structured schema (no RFC 9457) | `high` |
| `API-502` | Stack trace / SQL / ORM detail exposed in error body | `critical` |
| `API-503` | 200 OK with error payload ("always-200" antipattern) | `critical` |
| `API-504` | Inconsistent error schemas across endpoints | `high` |
| `API-505` | Missing `type` URI in Problem Details response | `medium` |
| `API-506` | 500 returned for client input validation | `critical` |
| `API-507` | GET handler has side effects (calls mutable operations) | `critical` |
| `API-508` | PUT used for partial update (should be PATCH) | `high` |
| `API-509` | DELETE throws 500 on already-deleted resource | `high` |
| `API-510` | POST used for idempotent operation without `Idempotency-Key` | `medium` |
| `API-511` | 401 vs 403 confusion in auth/authz middleware | `high` |
| `API-512` | 400 used for semantic validation (should be 422) | `medium` |
| `API-513` | Deprecated endpoint missing `Sunset` header | `medium` |
| `API-514` | Breaking change without version bump | `critical` |
| `API-521` | Collection endpoint returns unbounded results | `high` |
| `API-522` | Paginated response missing metadata (total/cursor/links) | `medium` |
| `API-523` | Offset pagination on large dataset | `medium` |
| `API-524` | Inconsistent pagination param names across endpoints | `low` |
| `API-531` | Response shapes differ for same resource across endpoints | `high` |
| `API-532` | Envelope inconsistency (`data.users` vs `users` mixed) | `medium` |
| `API-541` | Mutation endpoint missing authentication | `critical` |
| `API-542` | PII in URL path (email, token, SSN) | `high` |
| `API-551` | Inline schema instead of `$ref` (OpenAPI DRY violation) | `medium` |
| `API-552` | `operationId` not following `verbNoun` convention | `low` |

---

## Confidence Calibration Guide

| Range | Meaning | When to use |
| ------- | -------- | ----------- |
| `0.90–1.00` | Tool-confirmed; structural regex match | Phase 1 — CRUD verb in path, file extension, path param missing `required` |
| `0.80–0.89` | High structural confidence | Phase 1 — status code pattern, missing version prefix |
| `0.65–0.70` | Clear LLM-readable pattern — antipattern visible in one read | Phase 2 — stack trace in catch handler, 200 with error body |
| `0.55–0.64` | Probable — requires reading both route definition and handler | Phase 2 — GET side effects, error schema inconsistency |
| `0.40–0.54` | Heuristic — context-dependent, requires multiple files | Phase 2 — breaking change detection, 401/403 confusion |

---

## Composite Scoring Model

| Score | Grade | Criteria |
| ----- | ----- | -------- |
| 90–100 | A | No CRUD verbs in paths, correct status codes, RFC 9457 errors, versioned, paginated, OpenAPI complete |
| 75–89 | B | Minor naming issues, 1–2 status code violations, missing some OAS descriptions |
| 60–74 | C | Verb-based routes, inconsistent errors, missing pagination on some collections |
| 40–59 | D | Missing versioning, multiple HTTP semantic violations, inconsistent error shapes |
| < 40 | F | Raw errors/stack traces, no versioning, GET with side effects, no error contract |
