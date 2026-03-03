import { SEVERITY_RANK, type ConsolidatedReport, type Finding } from "../types.js";

export function diffReportFindings(
  reportA: ConsolidatedReport,
  reportB: ConsolidatedReport,
): { added: Finding[]; removed: Finding[]; unchanged: Finding[] } {
  const findingsA = reportA.domain_reports.flatMap((r) => r.findings);
  const findingsB = reportB.domain_reports.flatMap((r) => r.findings);
  const idsA = new Set(findingsA.map((f) => f.id));
  const idsB = new Set(findingsB.map((f) => f.id));

  const added = findingsA
    .filter((f) => !idsB.has(f.id))
    .sort((a, b) => SEVERITY_RANK[b.severity] - SEVERITY_RANK[a.severity]);
  const removed = findingsB
    .filter((f) => !idsA.has(f.id))
    .sort((a, b) => SEVERITY_RANK[b.severity] - SEVERITY_RANK[a.severity]);
  const unchanged = findingsA.filter((f) => idsB.has(f.id));

  return { added, removed, unchanged };
}
