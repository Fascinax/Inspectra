import { describe, it, expect } from "vitest";
import { renderSarif } from "../renderer/sarif.js";
import type { ConsolidatedReport } from "../types.js";
import { makeFinding, makeDomainReport } from "./fixtures.js";

function makeReport(overrides: Partial<ConsolidatedReport> = {}): ConsolidatedReport {
  return {
    overall_score: 75,
    grade: "B",
    summary: "Test audit report",
    domain_reports: [makeDomainReport()],
    top_findings: [makeFinding()],
    statistics: { total_findings: 1 },
    metadata: {
      timestamp: "2026-03-04T10:00:00.000Z",
      target: "/test",
      profile: "generic",
    },
    ...overrides,
  };
}

describe("renderSarif", () => {
  it("returns a valid JSON string", () => {
    const output = renderSarif(makeReport());
    expect(() => JSON.parse(output)).not.toThrow();
  });

  it("contains SARIF version 2.1.0", () => {
    const parsed = JSON.parse(renderSarif(makeReport()));
    expect(parsed.version).toBe("2.1.0");
  });

  it("contains Inspectra as the tool name", () => {
    const parsed = JSON.parse(renderSarif(makeReport()));
    const toolName = parsed.runs?.[0]?.tool?.driver?.name;
    expect(toolName).toBe("Inspectra");
  });

  it("includes results for findings", () => {
    const report = makeReport({
      domain_reports: [makeDomainReport({ findings: [makeFinding(), makeFinding({ id: "SEC-002" })] })],
    });
    const parsed = JSON.parse(renderSarif(report));
    expect(parsed.runs[0].results.length).toBeGreaterThanOrEqual(1);
  });

  it("maps severity to SARIF levels", () => {
    const report = makeReport({
      domain_reports: [makeDomainReport({ findings: [makeFinding({ severity: "critical" })] })],
    });
    const parsed = JSON.parse(renderSarif(report));
    const level = parsed.runs[0].results[0].level;
    expect(level).toBe("error");
  });
});
