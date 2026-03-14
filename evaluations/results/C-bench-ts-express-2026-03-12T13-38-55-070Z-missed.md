## Missed Issues

### RC-004: No observability strategy

- **OBS-GT-001** [medium] No health check endpoint (/health or /healthz) — src/index.ts:1 (🔧 tool-detectable)
- **OBS-GT-003** [medium] Swallowed exception in update — catch block returns generic error without logging — src/controllers/user.controller.ts:39 (🔧 tool-detectable)
- **OBS-GT-004** [medium] Swallowed exception in remove — catch block returns generic error without logging — src/controllers/user.controller.ts:47 (🔧 tool-detectable)

### RC-003: No test mandate or CI gate

- **TST-GT-002** [medium] No test file for auth.service.ts — src/services/auth.service.ts:1 (🔧 tool-detectable)

### (no root cause)

- **CNV-GT-002** [low] TODO: implement real JWT verification — src/services/auth.service.ts:52 (🔧 tool-detectable)
- **DEBT-GT-002** [medium] Deep nesting (6 levels) in authenticate method — src/services/auth.service.ts:19 (🔧 tool-detectable)
