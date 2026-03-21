# Inspectra Audit Report

> Generated: 2026-02-27T10:31:00.000Z | Profile: java-angular-playwright

## Executive Summary

| Metric | Value |
| -------- | ------- |
| **Overall Score** | 68/100 |
| **Grade** | C — Acceptable |
| **Total Findings** | 9 |
| **Critical** | 0 |
| **High** | 3 |
| **Medium** | 4 |
| **Low** | 2 |

The codebase is functional but has notable quality gaps, particularly in **test coverage** and **security** practices. Priority should be given to addressing hardcoded secrets and improving test coverage.

---

## Domain Scores

| Domain | Score | Grade | Findings |
| -------- | ------- | ------- | ---------- |
| Security | 72 | C | 4 |
| Tests | 65 | C | 3 |
| Architecture | 82 | B | 2 |
| Conventions | 88 | B | 0 |

---

## Top Priority Findings

### 1. 🔴 SEC-001 — Potential hardcoded API key in auth configuration
- **Severity**: high | **Confidence**: 0.91
- **File**: `src/config/auth.ts:14`
- **Fix**: Move the API key to an environment variable or a secrets manager.
- **Effort**: small

### 2. 🔴 TST-001 — Lines coverage below threshold: 58.3% < 80%
- **Severity**: high | **Confidence**: 1.00
- **File**: `coverage/coverage-summary.json`
- **Fix**: Add tests to increase lines coverage above 80%.
- **Effort**: medium

### 3. 🔴 ARC-001 — Layer violation: domain → infrastructure
- **Severity**: high | **Confidence**: 0.80
- **File**: `src/domain/models/user.entity.ts:3`
- **Fix**: Invert the dependency using an interface in the domain layer.
- **Effort**: large

### 4. 🟡 SEC-002 — Connection string with embedded credentials
- **Severity**: medium | **Confidence**: 0.88
- **File**: `src/config/database.ts:7`
- **Fix**: Extract credentials from the connection string.
- **Effort**: small

### 5. 🟡 SEC-003 — Vulnerable dependency: lodash@4.17.20
- **Severity**: medium | **Confidence**: 0.95
- **File**: `package-lock.json`
- **Fix**: Upgrade lodash to 4.17.21 or later.
- **Effort**: trivial

---

## Recommendations

1. **Immediate**: Remove hardcoded secrets from `src/config/auth.ts` and `src/config/database.ts`. Use environment variables.
2. **This sprint**: Run `npm audit fix` to address vulnerable dependencies.
3. **This sprint**: Add unit tests for `payment.service.ts` and `notification.service.ts`.
4. **Next sprint**: Refactor `user.entity.ts` to eliminate the domain→infrastructure dependency.
5. **Ongoing**: Set up coverage gates in CI to enforce the 80% threshold.

---

## Metadata

| Field | Value |
| ------- | ------- |
| Target | `/workspace/my-project` |
| Profile | java-angular-playwright |
| Domains Audited | security, tests, architecture, conventions |
| Duration | 12,540 ms |
