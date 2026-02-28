import type { Finding, DomainReport } from "../types.js";

export const makeFinding = (overrides: Partial<Finding> = {}): Finding => ({
  id: "SEC-001",
  severity: "high",
  title: "Hardcoded API key",
  domain: "security",
  rule: "no-hardcoded-secrets",
  confidence: 0.9,
  evidence: [{ file: "src/config.ts", line: 12 }],
  ...overrides,
});

export const makeDomainReport = (overrides: Partial<DomainReport> = {}): DomainReport => ({
  domain: "security",
  score: 80,
  summary: "One high severity finding.",
  findings: [makeFinding()],
  metadata: {
    agent: "audit-security",
    timestamp: "2026-02-27T10:00:00.000Z",
  },
  ...overrides,
});
