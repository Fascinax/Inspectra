import { z } from "zod";

export const SEVERITY_LEVELS = ["critical", "high", "medium", "low", "info"] as const;
export type Severity = (typeof SEVERITY_LEVELS)[number];

export const DOMAINS = ["security", "tests", "architecture", "conventions", "performance", "documentation"] as const;
export type Domain = (typeof DOMAINS)[number];

export const EFFORT_LEVELS = ["trivial", "small", "medium", "large", "epic"] as const;
export type Effort = (typeof EFFORT_LEVELS)[number];

export const GRADES = ["A", "B", "C", "D", "F"] as const;
export type Grade = (typeof GRADES)[number];

export const EvidenceSchema = z.object({
  file: z.string(),
  line: z.number().int().positive().optional(),
  snippet: z.string().max(500).optional(),
});

export const FindingSchema = z.object({
  id: z.string().regex(/^[A-Z]{2,5}-\d{3,4}$/),
  severity: z.enum(SEVERITY_LEVELS),
  title: z.string().max(200),
  description: z.string().max(2000).optional(),
  domain: z.enum(DOMAINS),
  rule: z.string(),
  confidence: z.number().min(0).max(1),
  evidence: z.array(EvidenceSchema).min(1),
  recommendation: z.string().max(1000).optional(),
  effort: z.enum(EFFORT_LEVELS).optional(),
  tags: z.array(z.string()).optional(),
});

export const DomainReportSchema = z.object({
  domain: z.enum(DOMAINS),
  score: z.number().int().min(0).max(100),
  summary: z.string().max(500),
  findings: z.array(FindingSchema),
  metadata: z.object({
    agent: z.string(),
    timestamp: z.string().datetime(),
    duration_ms: z.number().int().nonnegative().optional(),
    tools_used: z.array(z.string()).optional(),
  }),
});

export const ConsolidatedReportSchema = z.object({
  overall_score: z.number().int().min(0).max(100),
  grade: z.enum(GRADES),
  summary: z.string().max(2000),
  domain_reports: z.array(DomainReportSchema),
  top_findings: z.array(FindingSchema).max(10),
  statistics: z
    .object({
      total_findings: z.number().int().nonnegative(),
      by_severity: z
        .object({
          critical: z.number().int().nonnegative(),
          high: z.number().int().nonnegative(),
          medium: z.number().int().nonnegative(),
          low: z.number().int().nonnegative(),
          info: z.number().int().nonnegative(),
        })
        .optional(),
      by_domain: z.record(z.number().int().nonnegative()).optional(),
    })
    .optional(),
  metadata: z.object({
    timestamp: z.string().datetime(),
    target: z.string(),
    profile: z.string(),
    duration_ms: z.number().int().nonnegative().optional(),
    agents_invoked: z.array(z.string()).optional(),
  }),
});

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
}
