# Security Audit — Reference Material

> This file is the authoritative reference companion for the `audit-security` agent.
> It contains standards, mappings, and compliance tables that the agent uses during audits.
> The agent file (`.github/agents/audit-security.agent.md`) points here for full details.

---

## External References

| Standard / Resource | Version | Maintainer | URL |
| --------------------- | --------- | ------------ | ----- |
| OWASP Top 10 | 2021 | OWASP Foundation | <https://owasp.org/Top10/> |
| OWASP Cheat Sheet Series | latest | OWASP Foundation | <https://cheatsheetseries.owasp.org/> |
| OWASP Secure Code Review Guide | v2 | OWASP Foundation | <https://owasp.org/www-project-code-review-guide/> |
| OWASP Web Security Testing Guide (WSTG) | v4.2 | OWASP Foundation | <https://owasp.org/www-project-web-security-testing-guide/> |
| OWASP Application Security Verification Standard (ASVS) | 4.0.3 | OWASP Foundation | <https://owasp.org/www-project-application-security-verification-standard/> |
| OWASP Risk Rating Methodology | latest | OWASP Foundation | <https://owasp.org/www-community/OWASP_Risk_Rating_Methodology> |
| CWE/SANS Top 25 | 2023 | MITRE / SANS | <https://cwe.mitre.org/top25/> |
| CWE Database | latest | MITRE | <https://cwe.mitre.org/> |
| NIST SSDF SP 800-218 | v1.1 (2022) | NIST | <https://csrc.nist.gov/Projects/ssdf> |
| NIST SP 800-53 Rev 5 | 2020 | NIST | <https://csrc.nist.gov/publications/detail/sp/800-53/rev-5/final> |
| CERT Secure Coding Standards | latest | SEI / CMU | <https://wiki.sei.cmu.edu/confluence/display/seccode> |
| Claude-Code-Security-Audit | 2025 | MuzamilAdigun | <https://github.com/MuzamilAdigun/Claude-Code-Security-Audit> |

---

## OWASP Top 10 → Cheat Sheet Mapping

Each finding should be mapped to its OWASP Top 10 (2021) category and CWE. Use the OWASP Cheat Sheet Series as the authoritative remediation reference (source: [IndexTopTen.md](https://github.com/OWASP/CheatSheetSeries/blob/master/IndexTopTen.md)):

| ID | Category | What to look for | Key OWASP Cheat Sheets |
| ----- | ---------- | ------------------- | ------------------------ |
| A01 | Broken Access Control | IDOR, privilege escalation, tenant isolation, open redirect, missing RBAC, mass assignment | Authorization, IDOR Prevention, CSRF Prevention, Transaction Authorization |
| A02 | Cryptographic Failures | Secrets in code, weak hashing (MD5/SHA-1 for passwords), JWT misconfiguration, missing TLS | Cryptographic Storage, TLS, HSTS, Secrets Management, Key Management, Pinning |
| A03 | Injection | SQL injection, XSS, command injection, template injection, NoSQL injection, LDAP injection, XXE | Injection Prevention, SQL Injection Prevention, XSS Prevention, DOM XSS, OS Command Injection, Content Security Policy |
| A04 | Insecure Design | Missing rate limiting, bypassable business logic, no defense in depth, missing threat modeling | Threat Modeling, Abuse Case, Attack Surface Analysis |
| A05 | Security Misconfiguration | Missing HTTP security headers, permissive CORS, debug mode in prod, exposed `.env`, default credentials | IaC Security, XXE Prevention, Docker Security |
| A06 | Vulnerable Components | Dependencies with known CVEs, abandoned packages, unpinned versions | Vulnerable Dependency Management, Third Party JS Management, npm Security |
| A07 | Auth Failures | Brute-forceable login, weak credentials, session fixation, JWT without expiry, missing MFA | Authentication, Session Management, Forgot Password, Credential Stuffing Prevention, Password Storage, MFA |
| A08 | Software & Data Integrity | Unsigned webhooks, missing SRI on CDN scripts, insecure deserialization, supply chain attacks | Deserialization |
| A09 | Logging & Monitoring Failures | No audit trail, silent error swallowing, PII in logs, no alerting on auth failures | Logging, Logging Vocabulary |
| A10 | SSRF | User-controlled URLs fetched server-side without allowlist, internal IP access | SSRF Prevention |

---

## CWE/SANS Top 25 Coverage

The following CWE/SANS Top 25 (2023) entries are actively checked (source: <https://cwe.mitre.org/top25/>):

| Rank | CWE | Name |
| ------ | ----- | ------ |
| 1 | CWE-787 | Out-of-bounds Write |
| 2 | CWE-79 | Cross-site Scripting (XSS) |
| 3 | CWE-89 | SQL Injection |
| 4 | CWE-416 | Use After Free |
| 5 | CWE-78 | OS Command Injection |
| 6 | CWE-20 | Improper Input Validation |
| 7 | CWE-125 | Out-of-bounds Read |
| 8 | CWE-22 | Path Traversal |
| 9 | CWE-352 | Cross-Site Request Forgery (CSRF) |
| 10 | CWE-434 | Unrestricted Upload of File with Dangerous Type |
| 11 | CWE-862 | Missing Authorization |
| 12 | CWE-476 | NULL Pointer Dereference |
| 13 | CWE-287 | Improper Authentication |
| 14 | CWE-190 | Integer Overflow or Wraparound |
| 15 | CWE-502 | Deserialization of Untrusted Data |
| 16 | CWE-77 | Command Injection |
| 17 | CWE-119 | Improper Restriction of Operations within Memory Buffer |
| 18 | CWE-798 | Use of Hard-coded Credentials |
| 19 | CWE-918 | Server-Side Request Forgery (SSRF) |
| 20 | CWE-306 | Missing Authentication for Critical Function |
| 21 | CWE-362 | Concurrent Execution Using Shared Resource with Improper Synchronization (Race Condition) |
| 22 | CWE-269 | Improper Privilege Management |
| 23 | CWE-94 | Code Injection |
| 24 | CWE-863 | Incorrect Authorization |
| 25 | CWE-276 | Incorrect Default Permissions |

---

## Review Methodology

This agent follows the **OWASP Secure Code Review** methodology (source: <https://owasp.org/www-project-code-review-guide/>):

1. **Data Flow Analysis** — Trace data from sources (user inputs, API calls, file uploads) → processing (validation, transformation) → sinks (DB queries, file writes, output rendering). Validate security controls at each trust boundary. *(OWASP Secure Code Review Cheat Sheet §Review Techniques — Data Flow Analysis)*

2. **Threat-Based Review** — Align review with the **STRIDE model** (Spoofing, Tampering, Repudiation, Information Disclosure, Denial of Service, Elevation of Privilege) and OWASP Top 10. *(OWASP Threat Modeling Cheat Sheet)*

3. **Business Logic Review** — Analyze workflows for state management flaws, race conditions (TOCTOU), transaction integrity issues, resource limit bypasses, and authorization gaps at each workflow step. *(OWASP Secure Code Review Cheat Sheet §Business Logic Review)*

---

## Stack-Aware Detection

Adapt detection strategies to the target stack (source: [MuzamilAdigun/Claude-Code-Security-Audit](https://github.com/MuzamilAdigun/Claude-Code-Security-Audit) — security-audit-owasp-top10.md, Phase 1):

| Stack indicator | Framework | Key areas to check |
| ----------------- | ----------- | ------------------- |
| `package.json` | Node.js / Express / Fastify | `helmet()`, `cors()` config, `express-validator`, `child_process` |
| `next.config.*` | Next.js | `headers()`, middleware, `NEXT_PUBLIC_` env vars, API routes auth |
| `angular.json` | Angular | `bypassSecurityTrust*`, `[innerHTML]`, CSP, HTTP interceptors |
| `pyproject.toml` / `requirements.txt` | Python / Django / FastAPI / Flask | CORS middleware, auth decorators, `os.system()`, `pickle.loads()` |
| `pom.xml` / `build.gradle` | Java / Spring Boot | `SecurityConfig`, `@PreAuthorize`, `@Secured`, entity binding |
| `Gemfile` | Ruby / Rails | `before_action :authenticate`, `permit()`, CSRF token, `html_safe` |
| `go.mod` | Go | `sql.Query` parameterization, `exec.Command`, middleware chain |
| `*.csproj` / `Program.cs` | .NET / ASP.NET Core | `[Authorize]`, `[Bind]`, DTOs, `Startup.cs` security config |
| `Dockerfile` | Container | `USER` instruction, `HEALTHCHECK`, secrets in layers, base image pinning |

---

## Rule → OWASP → CWE → Compliance Mapping

| Rule ID | OWASP | CWE | Compliance refs | Description |
| --------- | ------- | ----- | ----------------- | ------------- |
| `hardcoded-secret` | A02 | CWE-798 | SOC2 CC6.1, ISO A.8.4, NIST IA-5, PCI R3, SSDF PS.4.1 | Credential stored in source code |
| `sql-injection` | A03 | CWE-89 | SOC2 CC6.1, ISO A.8.26, NIST SI-10, PCI R6.3 | SQL query built with string concatenation |
| `xss-risk` | A03 | CWE-79 | SOC2 CC6.1, ISO A.8.26, NIST SI-10, PCI R6.3 | Unsanitized HTML injection |
| `command-injection` | A03 | CWE-78 | SOC2 CC6.1, ISO A.8.28, NIST SI-10, PCI R6.5 | Shell command with user-controlled args |
| `nosql-injection` | A03 | CWE-943 | ISO A.8.26, NIST SI-10 | MongoDB operator injection |
| `path-traversal` | A03 | CWE-22 | ISO A.8.26, NIST SI-10, PCI R6.5 | File path manipulation |
| `missing-authentication` | A01 | CWE-862 | SOC2 CC6.1, ISO A.5.15, NIST AC-3, PCI R7 | Endpoint without auth middleware |
| `idor-unscoped-query` | A01 | CWE-639 | SOC2 CC6.1, ISO A.8.3, NIST AC-3, PCI R7 | DB query not filtered by user ownership |
| `mass-assignment` | A01 | CWE-915 | ISO A.8.26, NIST SI-10 | Unprotected model binding from request |
| `csrf-missing` | A01 | CWE-352 | ISO A.8.26, NIST SI-10, PCI R6.5 | State-changing form without CSRF protection |
| `open-redirect` | A01 | CWE-601 | ISO A.8.26, NIST SI-10 | Unvalidated redirect parameter |
| `weak-password-hash` | A02 | CWE-916 | SOC2 CC6.1, ISO A.8.24, NIST IA-5, PCI R8 | MD5/SHA-1 for password hashing |
| `jwt-misconfiguration` | A02 | CWE-347 | SOC2 CC6.1, ISO A.8.5, NIST IA-5 | JWT alg=none, missing exp, weak secret |
| `secret-in-frontend` | A02 | CWE-798 | SOC2 CC6.1, ISO A.8.4, SSDF PS.4.1 | Secret in NEXT_PUBLIC_/VITE_ env var |
| `missing-security-headers` | A05 | CWE-16 | SOC2 CC6.2, ISO A.8.21, NIST SC-8 | Missing CSP, HSTS, X-Frame-Options |
| `permissive-cors` | A05 | CWE-942 | SOC2 CC6.3, ISO A.8.20, NIST SC-7 | CORS origin=* with credentials |
| `debug-in-production` | A05 | CWE-209 | SOC2 CC6.1, ISO A.8.9, NIST CM-6 | Debug mode/stack traces in prod |
| `pii-in-logs` | A09 | CWE-532 | SOC2 CC2, ISO A.8.11, NIST AU-3, GDPR Art.32 | Sensitive data logged in plaintext |
| `ssrf` | A10 | CWE-918 | ISO A.8.26, NIST SI-10 | User-controlled URL fetched server-side |
| `unsigned-webhook` | A08 | CWE-345 | SOC2 CC6.1, ISO A.8.26, PCI R6.5 | Webhook processed without signature check |
| `insecure-deserialization` | A08 | CWE-502 | ISO A.8.26, NIST SI-10, PCI R6.5 | Untrusted data deserialized |
| `vulnerable-dependency` | A06 | CWE-1035 | SOC2 CC7.1, ISO A.8.8, NIST SI-2, PCI R6.2, SSDF PW.5.1 | Dependency with known CVE |
| `docker-root-user` | A05 | CWE-250 | CIS Docker 4.2 | Container running as root |
| `race-condition` | A04 | CWE-362 | ISO A.8.26, NIST SI-10 | Concurrent operation without synchronization |
| `timing-unsafe-compare` | A02 | CWE-208 | ISO A.8.24, NIST IA-5 | Secret comparison not constant-time |
| `unbounded-query` | A04 | CWE-770 | ISO A.8.26, NIST SC-5 | Missing server-side pagination limit |
| `exposed-api-docs` | A05 | CWE-209 | ISO A.8.9, NIST CM-6 | Swagger/GraphQL introspection in prod |

---

## Severity Guide — Compliance Impact

Severity follows OWASP Risk Rating Methodology (source: <https://owasp.org/www-community/OWASP_Risk_Rating_Methodology>), CWE/SANS Top 25, and NIST SP 800-53 Rev 5 impact levels.

| Severity | OWASP | CWE examples | Compliance impact | Description |
| ---------- | ------- | ------------- | ------------------- | ------------- |
| critical | A01, A02, A03 | CWE-798, CWE-78, CWE-89, CWE-287 | SOC 2 CC6.1, ISO 27001 A.8.5, NIST IA-2, PCI-DSS R8 | Exposed secrets in code, RCE vectors, auth bypass, unprotected destructive endpoints |
| high | A01, A03, A06, A07 | CWE-862, CWE-639, CWE-79, CWE-345, CWE-502 | SOC 2 CC7.1, ISO 27001 A.8.26, NIST SI-10, PCI-DSS R6 | Vulnerable deps with known exploits, SQL injection, IDOR, missing auth, unsigned webhooks |
| medium | A02, A05, A08, A10 | CWE-916, CWE-942, CWE-918, CWE-352, CWE-362 | SOC 2 CC6.2, ISO 27001 A.8.24, NIST SC-8, PCI-DSS R4 | Weak crypto, permissive CORS, SSRF, CSRF, open redirect, race conditions |
| low | A05, A09 | CWE-16, CWE-532, CWE-250, CWE-209 | SOC 2 CC7.2, ISO 27001 A.8.15, NIST AU-2 | Missing security headers, PII in logs, minor config issues, debug info leaks |
| info | — | — | — | Best practice suggestions, defense-in-depth recommendations |

### Remediation Timelines

Source: NIST SI-2 (Flaw Remediation), PCI-DSS R6.2, [MuzamilAdigun/Claude-Code-Security-Audit](https://github.com/MuzamilAdigun/Claude-Code-Security-Audit)

| Severity | SLA | Rationale |
| ---------- | ----- | ----------- |
| critical | 0–7 days | Direct exploit path from public endpoint. PCI-DSS R6.2 requires critical patches ≤30 days. |
| high | 7–30 days | Exploitable with specific conditions. |
| medium | 30–90 days | Risk exists but mitigated. |
| low/info | 90+ days | No clear attack vector. |

---

## Compliance Awareness

While the security agent focuses on code-level findings (OWASP Top 10 + CWE), each finding carries implicit compliance impact across multiple frameworks. This awareness is inspired by [MuzamilAdigun's multi-framework audit approach](https://github.com/MuzamilAdigun/Claude-Code-Security-Audit), which covers 9 compliance frameworks in parallel.

| Framework | Version | Key overlap with security audit scope |
| ----------- | --------- | --------------------------------------- |
| OWASP Top 10 | 2021 | **Primary** — all 10 categories actively checked |
| SOC 2 Type II | TSC 2017+2022 | CC6 (Logical Access), CC7 (Operations), CC8 (Change Management) |
| ISO 27001 | 2022 | A.8 Technological controls — esp. A.8.24 (Crypto), A.8.25 (SDLC), A.8.26 (App Security), A.8.28 (Secure Coding) |
| NIST SP 800-53 | Rev 5 (2020) | AC (Access Control), IA (Auth), SC (Communications), SI (Integrity) |
| NIST SSDF | SP 800-218 v1.1 | PW (Produce Well-Secured Software) — esp. PW.4.1 (SAST), PW.5 (SCA), PW.7 (Input Validation) |
| PCI-DSS | v4.0 (2022) | Req 3 (Data protection), Req 6 (Secure dev), Req 8 (Auth) |
| CIS Benchmarks | Docker v1.6+, K8s v1.8+ | Container security, infrastructure hardening |
| CWE/SANS Top 25 | 2023 | 25 most dangerous software weaknesses — tracked in rule mapping above |

**Note**: The agent does NOT perform full compliance audits. It flags code-level security issues and maps them to these frameworks for downstream use by the orchestrator.

---

## Confidence Calibration

Confidence levels follow OWASP Risk Rating Methodology (source: <https://owasp.org/www-community/OWASP_Risk_Rating_Methodology>) and OWASP ASVS verification levels (source: <https://owasp.org/www-project-application-security-verification-standard/>):

| Confidence | Meaning | Equivalent |
| ------------ | --------- | ------------ |
| 0.65–0.70 | Clear data flow from user-controlled input to dangerous sink in production code, confirmed by reading both source and sink. | OWASP ASVS L1 verification |
| 0.50–0.64 | Possible injection/auth gap, requires dynamic analysis or runtime context to confirm exploitability. | OWASP Risk Rating "likely" likelihood |
| 0.35–0.49 | Architectural concern (e.g., auth pattern inconsistency) without a confirmed exploit path. | OWASP Risk Rating "possible" likelihood |
