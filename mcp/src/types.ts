import { z } from "zod";

export const SEVERITY_LEVELS = ["critical", "high", "medium", "low", "info"] as const;
export type Severity = (typeof SEVERITY_LEVELS)[number];

/** Numeric severity rank � higher value means more severe. Use for comparisons and sorting. */
export const SEVERITY_RANK: Record<Severity, number> = {
  critical: 5,
  high: 4,
  medium: 3,
  low: 2,
  info: 1,
};

export const DOMAINS = [
  "security",
  "tests",
  "architecture",
  "conventions",
  "performance",
  "documentation",
  "tech-debt",
] as const;
export type Domain = (typeof DOMAINS)[number];

export const EFFORT_LEVELS = ["trivial", "small", "medium", "large", "epic"] as const;
export type Effort = (typeof EFFORT_LEVELS)[number];

export const GRADES = ["A", "B", "C", "D", "F"] as const;
export type Grade = (typeof GRADES)[number];

export const EvidenceSchema = z
  .object({
    file: z.string().min(1).describe("Relative or absolute file path"),
    line: z.number().int().positive().optional().describe("1-based line number"),
    snippet: z.string().max(500).optional().describe("Source code snippet around the finding"),
  })
  .strict()
  .describe("Location evidence for a finding");

export const FindingSchema = z
  .object({
    id: z
      .string()
      .regex(/^[A-Z]{2,5}-\d{3,4}$/)
      .describe("Finding ID matching DOMAIN_PREFIX-NNN (e.g. SEC-001, TST-042)"),
    severity: z.enum(SEVERITY_LEVELS).describe("Severity level of the finding"),
    title: z.string().min(1).max(200).describe("Short human-readable title"),
    description: z.string().max(2000).optional().describe("Detailed explanation of the issue"),
    domain: z.enum(DOMAINS).describe("Audit domain that produced this finding"),
    rule: z.string().min(1).describe("Machine-readable rule identifier (e.g. hardcoded-secret)"),
    confidence: z.number().min(0).max(1).describe("Confidence score between 0.0 and 1.0"),
    evidence: z.array(EvidenceSchema).min(1).describe("At least one evidence location"),
    recommendation: z.string().max(1000).optional().describe("Suggested fix or remediation"),
    effort: z.enum(EFFORT_LEVELS).optional().describe("Estimated effort to fix"),
    tags: z.array(z.string()).optional().describe("Classification tags for filtering"),
    source: z.enum(["tool", "llm"]).optional().describe("Source of the finding: 'tool' for MCP tool detections, 'llm' for LLM analysis"),
  })
  .strict()
  .describe("A single audit finding");

export const DomainReportSchema = z
  .object({
    domain: z.enum(DOMAINS).describe("Audit domain (e.g. security, tests)"),
    score: z.number().int().min(0).max(100).describe("Domain score from 0 (worst) to 100 (best)"),
    summary: z.string().min(1).max(500).describe("Brief summary of domain audit results"),
    findings: z.array(FindingSchema).describe("All findings produced by this domain"),
    metadata: z
      .object({
        agent: z.string().min(1).describe("Agent name that produced this report"),
        timestamp: z.string().datetime().describe("ISO 8601 timestamp"),
        duration_ms: z.number().int().nonnegative().optional().describe("Audit duration in milliseconds"),
        tools_used: z.array(z.string()).optional().describe("MCP tool names invoked during audit"),
      })
      .strict()
      .describe("Report metadata"),
  })
  .strict()
  .describe("A single domain audit report");

export const ConsolidatedReportSchema = z
  .object({
    overall_score: z.number().int().min(0).max(100).describe("Weighted overall score (0-100)"),
    grade: z.enum(GRADES).describe("Letter grade derived from overall score"),
    summary: z.string().min(1).max(2000).describe("Executive summary of the full audit"),
    domain_reports: z.array(DomainReportSchema).describe("Individual domain reports"),
    top_findings: z.array(FindingSchema).max(10).describe("Top 10 most critical findings"),
    statistics: z
      .object({
        total_findings: z.number().int().nonnegative().describe("Total number of findings"),
        by_severity: z
          .object({
            critical: z.number().int().nonnegative().describe("Count of critical findings"),
            high: z.number().int().nonnegative().describe("Count of high findings"),
            medium: z.number().int().nonnegative().describe("Count of medium findings"),
            low: z.number().int().nonnegative().describe("Count of low findings"),
            info: z.number().int().nonnegative().describe("Count of info findings"),
          })
          .strict()
          .optional()
          .describe("Breakdown by severity level"),
        by_domain: z
          .record(z.number().int().nonnegative())
          .optional()
          .describe("Breakdown by domain name"),
      })
      .strict()
      .optional()
      .describe("Aggregate statistics"),
    metadata: z
      .object({
        timestamp: z.string().datetime().describe("ISO 8601 timestamp of report generation"),
        target: z.string().min(1).describe("Repository or path that was audited"),
        profile: z.string().min(1).describe("Policy profile used for scoring"),
        duration_ms: z.number().int().nonnegative().optional().describe("Total audit duration in milliseconds"),
        agents_invoked: z.array(z.string()).optional().describe("List of agents that participated"),
      })
      .strict()
      .describe("Consolidated report metadata"),
  })
  .strict()
  .describe("Full consolidated audit report");

export type Evidence = z.infer<typeof EvidenceSchema>;
export type Finding = z.infer<typeof FindingSchema>;
export type DomainReport = z.infer<typeof DomainReportSchema>;
export type ConsolidatedReport = z.infer<typeof ConsolidatedReportSchema>;

export interface GradeConfig {
  min_score: number;
  label: string;
  description: string;
}

export interface ScoringConfig {
  severity_weights: Record<string, number>;
  domain_weights: Record<string, number>;
  grades?: Record<string, GradeConfig>;
}

export interface SecurityPatternOverride {
  rule: string;
  pattern: string;
  severity: string;
}

export interface ProfileConfig {
  profile: string;
  coverage?: {
    lines?: { minimum: number; target: number };
    branches?: { minimum: number; target: number };
    functions?: { minimum: number; target: number };
  };
  file_lengths?: {
    warning: number;
    error: number;
  };
  naming?: Record<string, Record<string, string>>;
  architecture?: {
    layers?: string[];
    allowed_dependencies?: Record<string, string[]>;
  };
  security?: {
    additional_patterns?: SecurityPatternOverride[];
  };
  complexity_threshold?: number;
}