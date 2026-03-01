import type { ConsolidatedReport, Finding } from "../types.js";

const SARIF_VERSION = "2.1.0";
const SARIF_SCHEMA = "https://raw.githubusercontent.com/oasis-tcs/sarif-spec/main/sarif-2.1/schema/sarif-schema-2.1.0.json";
const TOOL_NAME = "Inspectra";
const TOOL_INFO_URI = "https://github.com/inspectra/inspectra";

interface SarifMessage { text: string }
interface SarifArtifactLocation { uri: string }
interface SarifRegion { startLine?: number }

interface SarifPhysicalLocation {
  artifactLocation: SarifArtifactLocation;
  region?: SarifRegion;
}

interface SarifLocation { physicalLocation: SarifPhysicalLocation }

type SarifLevel = "error" | "warning" | "note" | "none";

interface SarifResult {
  ruleId: string;
  level: SarifLevel;
  message: SarifMessage;
  locations: SarifLocation[];
  properties: Record<string, unknown>;
}

interface SarifReportingDescriptor {
  id: string;
  shortDescription: SarifMessage;
  helpUri?: string;
  properties: Record<string, unknown>;
}

interface SarifRun {
  tool: {
    driver: {
      name: string;
      version: string;
      informationUri: string;
      rules: SarifReportingDescriptor[];
    };
  };
  results: SarifResult[];
  invocations: Array<{
    executionSuccessful: boolean;
    endTimeUtc?: string;
  }>;
}

interface SarifLog {
  version: string;
  $schema: string;
  runs: SarifRun[];
}

const SEVERITY_TO_SARIF_LEVEL: Record<string, SarifLevel> = {
  critical: "error",
  high: "error",
  medium: "warning",
  low: "note",
  info: "none",
};

function mapSeverityToLevel(severity: string): SarifLevel {
  return SEVERITY_TO_SARIF_LEVEL[severity] ?? "note";
}

function buildLocations(finding: Finding): SarifLocation[] {
  if (!finding.evidence || finding.evidence.length === 0) {
    return [];
  }

  return finding.evidence.map((ev) => ({
    physicalLocation: {
      artifactLocation: { uri: ev.file },
      ...(ev.line ? { region: { startLine: ev.line } } : {}),
    },
  }));
}

function buildRuleDescriptor(finding: Finding): SarifReportingDescriptor {
  return {
    id: finding.rule,
    shortDescription: { text: finding.title },
    properties: {
      domain: finding.domain,
    },
  };
}

function buildResult(finding: Finding): SarifResult {
  const description = finding.description
    ? `${finding.title}\n\n${finding.description}`
    : finding.title;

  return {
    ruleId: finding.rule,
    level: mapSeverityToLevel(finding.severity),
    message: { text: description },
    locations: buildLocations(finding),
    properties: {
      severity: finding.severity,
      domain: finding.domain,
      confidence: finding.confidence,
      ...(finding.recommendation ? { recommendation: finding.recommendation } : {}),
      ...(finding.effort ? { effort: finding.effort } : {}),
    },
  };
}

function collectAllFindings(report: ConsolidatedReport): Finding[] {
  return report.domain_reports.flatMap((dr) => dr.findings);
}

export function renderSarif(report: ConsolidatedReport): string {
  const allFindings = collectAllFindings(report);

  const seenRuleIds = new Set<string>();
  const rules: SarifReportingDescriptor[] = [];
  const results: SarifResult[] = [];

  for (const finding of allFindings) {
    if (!seenRuleIds.has(finding.rule)) {
      seenRuleIds.add(finding.rule);
      rules.push(buildRuleDescriptor(finding));
    }
    results.push(buildResult(finding));
  }

  const sarifLog: SarifLog = {
    version: SARIF_VERSION,
    $schema: SARIF_SCHEMA,
    runs: [
      {
        tool: {
          driver: {
            name: TOOL_NAME,
            version: "0.1.0",
            informationUri: TOOL_INFO_URI,
            rules,
          },
        },
        results,
        invocations: [
          {
            executionSuccessful: true,
            ...(report.metadata?.timestamp ? { endTimeUtc: report.metadata.timestamp } : {}),
          },
        ],
      },
    ],
  };

  return JSON.stringify(sarifLog, null, 2);
}
