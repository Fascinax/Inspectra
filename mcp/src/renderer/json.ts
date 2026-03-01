import type { ConsolidatedReport } from "../types.js";

export function renderJson(report: ConsolidatedReport): string {
  return JSON.stringify(report, null, 2);
}
