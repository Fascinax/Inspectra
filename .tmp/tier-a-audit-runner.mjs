import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";
import { mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { isAbsolute, join, relative, resolve } from "node:path";

const workspaceRoot = process.cwd();
const targetDir = resolve(workspaceRoot, "evaluations/fixtures/bench-java-spring");
const targetName = "evaluations/fixtures/bench-java-spring";
const profile = "java-backend";
const now = new Date().toISOString();
const inspectraDir = join(targetDir, ".inspectra");

const DOMAINS = [
  "security",
  "tests",
  "architecture",
  "conventions",
  "performance",
  "documentation",
  "tech-debt",
  "accessibility",
  "api-design",
  "observability",
  "i18n",
  "ux-consistency",
];

const toolPlan = [
  { name: "inspectra_scan_secrets", args: { projectDir: targetDir }, domain: "security" },
  { name: "inspectra_check_deps_vulns", args: { projectDir: targetDir }, domain: "security" },
  { name: "inspectra_check_security_config", args: { projectDir: targetDir }, domain: "security" },
  { name: "inspectra_detect_missing_tests", args: { projectDir: targetDir }, domain: "tests" },
  { name: "inspectra_check_layering", args: { projectDir: targetDir, profile }, domain: "architecture" },
  { name: "inspectra_analyze_dependencies", args: { projectDir: targetDir }, domain: "architecture" },
  { name: "inspectra_detect_circular_deps", args: { projectDir: targetDir }, domain: "architecture" },
  { name: "inspectra_check_naming", args: { projectDir: targetDir, profile }, domain: "conventions" },
  { name: "inspectra_check_file_lengths", args: { projectDir: targetDir, profile }, domain: "conventions" },
  { name: "inspectra_check_function_lengths", args: { projectDir: targetDir, profile }, domain: "conventions" },
  { name: "inspectra_check_param_counts", args: { projectDir: targetDir, profile }, domain: "conventions" },
  { name: "inspectra_check_magic_numbers", args: { projectDir: targetDir }, domain: "conventions" },
  { name: "inspectra_check_todos", args: { projectDir: targetDir }, domain: "conventions" },
  { name: "inspectra_analyze_bundle_size", args: { projectDir: targetDir }, domain: "performance" },
  { name: "inspectra_check_readme_completeness", args: { projectDir: targetDir }, domain: "documentation" },
  { name: "inspectra_check_adr_presence", args: { projectDir: targetDir }, domain: "documentation" },
  { name: "inspectra_detect_doc_code_drift", args: { projectDir: targetDir }, domain: "documentation" },
  { name: "inspectra_analyze_complexity", args: { projectDir: targetDir, profile }, domain: "tech-debt" },
  { name: "inspectra_check_dependency_staleness", args: { projectDir: targetDir }, domain: "tech-debt" },
  { name: "inspectra_detect_deprecated_apis", args: { projectDir: targetDir }, domain: "tech-debt" },
  { name: "inspectra_detect_code_smells", args: { projectDir: targetDir }, domain: "tech-debt" },
  { name: "inspectra_check_dead_exports", args: { projectDir: targetDir }, domain: "tech-debt" },
  { name: "inspectra_check_a11y_templates", args: { projectDir: targetDir }, domain: "accessibility" },
  { name: "inspectra_check_rest_conventions", args: { projectDir: targetDir }, domain: "api-design" },
  { name: "inspectra_check_observability", args: { projectDir: targetDir }, domain: "observability" },
  { name: "inspectra_check_i18n", args: { projectDir: targetDir }, domain: "i18n" },
  { name: "inspectra_check_ux_consistency", args: { projectDir: targetDir }, domain: "ux-consistency" },
];

const severityRank = { critical: 5, high: 4, medium: 3, low: 2, info: 1 };

function extractPayload(result) {
  if (result?.structuredContent) {
    return result.structuredContent;
  }
  const textPart = Array.isArray(result?.content) ? result.content.find((item) => item.type === "text") : undefined;
  if (!textPart?.text) {
    throw new Error("Tool returned no parseable payload");
  }
  return JSON.parse(textPart.text);
}

function normalizeText(value) {
  return String(value || "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

function normalizeFilePath(filePath) {
  if (!filePath) return "unknown";
  const resolvedTarget = targetDir.toLowerCase();
  const normalized = String(filePath).replace(/\\/g, "/");
  if (isAbsolute(filePath) && filePath.toLowerCase().startsWith(resolvedTarget)) {
    return relative(targetDir, filePath).replace(/\\/g, "/");
  }
  return normalized;
}

function normalizeFindingPaths(findings) {
  return findings.map((finding) => ({
    ...finding,
    evidence: (finding.evidence || []).map((evidence) => ({
      ...evidence,
      file: normalizeFilePath(evidence.file),
    })),
  }));
}

function categoryForFinding(finding) {
  const text = normalizeText(`${finding.rule} ${finding.title} ${finding.description || ""}`);
  if (text.includes("missing test") || text.includes("untested")) return "test-coverage";
  if (text.includes("csrf") || text.includes("permitall") || text.includes("cors") || text.includes("actuator") || text.includes("exception message") || text.includes("info leak") || text.includes("security")) return "security-config";
  if (text.includes("secret") || text.includes("password") || text.includes("jwt")) return "secret-management";
  if (text.includes("layer") || text.includes("circular")) return "architecture-boundaries";
  if (text.includes("dependency") || text.includes("version") || text.includes("stale") || text.includes("vulnerab")) return "dependency-governance";
  if (text.includes("httpsession") || text.includes("stateful rest") || text.includes("version prefix") || text.includes("route")) return "api-governance";
  if (text.includes("data on jpa entity") || text.includes("cascade") || text.includes("lazy self injection") || text.includes("entity")) return "maintainability";
  if (text.includes("complex") || text.includes("god class") || text.includes("deep nesting") || text.includes("dead export") || text.includes("deprecated")) return "maintainability";
  if (text.includes("function length") || text.includes("parameter") || text.includes("magic number") || text.includes("todo") || text.includes("naming") || text.includes("file length")) return "code-quality-guardrails";
  if (text.includes("readme") || text.includes("adr") || text.includes("doc") || text.includes("drift")) return "documentation-discipline";
  if (text.includes("health") || text.includes("trace") || text.includes("observability") || text.includes("log") || text.includes("metrics")) return "operational-observability";
  if (text.includes("i18n") || text.includes("translation") || text.includes("hardcoded string")) return "localization-strategy";
  if (text.includes("accessibility") || text.includes("label") || text.includes("alt text") || text.includes("aria")) return "accessibility-baseline";
  if (text.includes("color") || text.includes("token") || text.includes("inline style") || text.includes("design")) return "design-system";
  if (text.includes("bundle")) return "frontend-performance";
  return `${finding.domain}:${finding.rule}`;
}

function findingKey(finding) {
  const evidence = Array.isArray(finding.evidence) && finding.evidence.length > 0 ? finding.evidence[0] : {};
  const file = normalizeText(evidence.file || "unknown-file");
  const line = evidence.line || 0;
  return `${file}|${line}|${categoryForFinding(finding)}`;
}

function dedupeFindings(findings) {
  const kept = new Map();
  for (const finding of findings) {
    const key = findingKey(finding);
    const existing = kept.get(key);
    if (!existing || (finding.confidence ?? 0) > (existing.confidence ?? 0)) {
      kept.set(key, finding);
    }
  }
  return Array.from(kept.values());
}

function gradeFromScore(score) {
  if (score >= 90) return "A";
  if (score >= 75) return "B";
  if (score >= 60) return "C";
  if (score >= 40) return "D";
  return "F";
}

function severityCounts(findings) {
  return findings.reduce((acc, finding) => {
    acc[finding.severity] = (acc[finding.severity] || 0) + 1;
    return acc;
  }, { critical: 0, high: 0, medium: 0, low: 0, info: 0 });
}

function rootCauseLabel(code) {
  const labels = {
    "secret-management": "No secret management strategy",
    "security-config": "Security controls are configured inconsistently",
    "test-coverage": "No enforced test coverage discipline",
    "architecture-boundaries": "Module boundaries are not enforced",
    "dependency-governance": "Dependency governance is weak",
    "maintainability": "SRP violations and maintainability hotspots are accumulating",
    "code-quality-guardrails": "Code quality guardrails are not enforced",
    "documentation-discipline": "Documentation is not maintained with code changes",
    "api-governance": "REST API conventions are not standardized",
    "operational-observability": "Operational observability baseline is incomplete",
    "localization-strategy": "No localization strategy is in place",
    "accessibility-baseline": "Accessibility baseline is missing in UI surfaces",
    "design-system": "No consistent design-system enforcement",
    "frontend-performance": "No frontend performance budget or build artifacts are available",
  };
  return labels[code] || code;
}

function recommendationForRootCause(code) {
  const recommendations = {
    "secret-management": "Move secrets to environment or secret-store configuration and rotate compromised values.",
    "security-config": "Define secure Spring defaults for authz, CSRF, validation, and actuator exposure, then enforce them in one place.",
    "test-coverage": "Add tests for untested classes and gate merges on minimum coverage for critical packages.",
    "architecture-boundaries": "Define package-level dependency rules and fail CI on layering or cycle violations.",
    "dependency-governance": "Introduce dependency review and scheduled upgrades with lockfile or BOM hygiene.",
    "maintainability": "Split oversized classes and methods by responsibility, then extract shared logic behind smaller abstractions.",
    "code-quality-guardrails": "Enforce lint/static-analysis rules for naming, complexity, TODO hygiene, and magic numbers in CI.",
    "documentation-discipline": "Treat README/ADR updates as part of every feature or operational change.",
    "api-governance": "Adopt versioned, resource-oriented route conventions and validate them in automated checks.",
    "operational-observability": "Add health endpoints plus consistent logging, tracing, and metrics instrumentation.",
    "localization-strategy": "Introduce an i18n layer before more user-facing strings spread through the codebase.",
    "accessibility-baseline": "Add template accessibility checks and accessible component patterns before UI surface expands.",
    "design-system": "Centralize visual tokens and ban ad hoc inline styling or hardcoded design values.",
    "frontend-performance": "Generate and track build artifacts so bundle-size regression checks can run in CI.",
  };
  return recommendations[code] || "Address the shared underlying engineering practice, then remove the individual symptoms.";
}

function assessmentForHotspot(entry) {
  const severities = entry.findings.map((finding) => severityRank[finding.severity] || 0);
  const maxSeverity = Math.max(0, ...severities);
  if (entry.count >= 3 || maxSeverity >= 4) return "High-priority refactor target";
  if (entry.count === 2) return "Medium-priority cleanup target";
  return "Localized issue cluster";
}

function formatRunTimestamp(date) {
  const pad = (value) => String(value).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())} ${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

async function main() {
  await rm(inspectraDir, { recursive: true, force: true });
  await mkdir(inspectraDir, { recursive: true });
  const transport = new StdioClientTransport({
    command: "node",
    args: [resolve(workspaceRoot, "mcp", "dist", "index.js")],
    env: { ...process.env, INSPECTRA_LOG_LEVEL: "warn" },
  });

  const client = new Client({ name: "tier-a-audit-runner", version: "1.0.0" });
  await client.connect(transport);

  const domainFindings = new Map(DOMAINS.map((domain) => [domain, []]));
  const domainTools = new Map(DOMAINS.map((domain) => [domain, new Set()]));
  const toolResults = [];

  try {
    for (const tool of toolPlan) {
      let offset = 0;
      const collected = [];
      while (true) {
        const result = await client.callTool({
          name: tool.name,
          arguments: { ...tool.args, responseFormat: "json", limit: 100, offset },
        });
        if (result.isError) {
          throw new Error(`${tool.name} failed: ${JSON.stringify(extractPayload(result))}`);
        }
        const payload = extractPayload(result);
        const pageFindings = normalizeFindingPaths(Array.isArray(payload.findings) ? payload.findings : []);
        collected.push(...pageFindings);
        if (!payload.has_more) {
          break;
        }
        offset = payload.next_offset;
      }

      const dedupedToolFindings = dedupeFindings(collected);
      const bucket = domainFindings.get(tool.domain);
      bucket.push(...dedupedToolFindings);
      domainTools.get(tool.domain).add(tool.name);
      toolResults.push({ tool: tool.name, domain: tool.domain, findings: dedupedToolFindings.length });
    }

    const domainReports = [];

    for (const domain of DOMAINS) {
      const uniqueFindings = dedupeFindings(domainFindings.get(domain));
      domainFindings.set(domain, uniqueFindings);
      const scoreResult = await client.callTool({
        name: "inspectra_score_findings",
        arguments: { findingsJson: JSON.stringify(uniqueFindings) },
      });
      if (scoreResult.isError) {
        throw new Error(`inspectra_score_findings failed for ${domain}: ${JSON.stringify(extractPayload(scoreResult))}`);
      }
      const scorePayload = extractPayload(scoreResult);
      const score = scorePayload.score;
      const toolsUsed = Array.from(domainTools.get(domain));
      const highestSeverity = uniqueFindings.length === 0
        ? null
        : uniqueFindings.map((finding) => finding.severity).sort((a, b) => severityRank[b] - severityRank[a])[0];
      const summary = uniqueFindings.length === 0
        ? "No deterministic Tier A findings."
        : `${uniqueFindings.length} deterministic finding${uniqueFindings.length === 1 ? "" : "s"} across ${toolsUsed.length} tool${toolsUsed.length === 1 ? "" : "s"}. Highest severity: ${highestSeverity}.`;

      domainReports.push({
        domain,
        score,
        summary,
        findings: uniqueFindings,
        metadata: {
          agent: "audit-tier-a",
          timestamp: now,
          tools_used: toolsUsed,
        },
      });
    }

    const mergeResult = await client.callTool({
      name: "inspectra_merge_domain_reports",
      arguments: {
        domainReportsJson: JSON.stringify(domainReports),
        target: targetName,
        profile,
        projectDir: targetDir,
        responseFormat: "json",
      },
    });

    if (mergeResult.isError) {
      throw new Error(`inspectra_merge_domain_reports failed: ${JSON.stringify(extractPayload(mergeResult))}`);
    }

    const consolidated = JSON.parse(await readFile(join(inspectraDir, "consolidated-report.json"), "utf8"));
    const allDedupedFindings = dedupeFindings(domainReports.flatMap((report) => report.findings));
    const bySeverity = severityCounts(allDedupedFindings);

    const rootCauseBuckets = new Map();
    for (const finding of allDedupedFindings) {
      const code = categoryForFinding(finding);
      const bucket = rootCauseBuckets.get(code) || { code, findings: [], domains: new Set() };
      bucket.findings.push(finding);
      bucket.domains.add(finding.domain);
      rootCauseBuckets.set(code, bucket);
    }

    const allRootCauses = Array.from(rootCauseBuckets.values())
      .map((bucket, index) => ({
        id: `RC-${String(index + 1).padStart(3, "0")}`,
        code: bucket.code,
        title: rootCauseLabel(bucket.code),
        domains: Array.from(bucket.domains).sort(),
        symptomCount: bucket.findings.length,
        severityWeight: bucket.findings.reduce((sum, finding) => sum + (severityRank[finding.severity] || 0), 0),
        recommendation: recommendationForRootCause(bucket.code),
      }))
      .sort((left, right) => {
        if (right.symptomCount !== left.symptomCount) return right.symptomCount - left.symptomCount;
        return right.severityWeight - left.severityWeight;
      });

    const rootCauses = allRootCauses;

    const rootCauseLookup = new Map(allRootCauses.map((rootCause) => [rootCause.code, rootCause.id]));

    const hotspotMap = new Map();
    for (const finding of allDedupedFindings) {
      for (const evidence of finding.evidence || []) {
        const file = evidence.file;
        if (!file) continue;
        const entry = hotspotMap.get(file) || { file, domains: new Set(), findings: [] };
        entry.domains.add(finding.domain);
        entry.findings.push(finding);
        hotspotMap.set(file, entry);
      }
    }

    const hotspots = Array.from(hotspotMap.values())
      .map((entry) => ({
        file: entry.file,
        domains: Array.from(entry.domains).sort(),
        count: dedupeFindings(entry.findings).length,
        findings: dedupeFindings(entry.findings),
        severityWeight: dedupeFindings(entry.findings).reduce((sum, finding) => sum + (severityRank[finding.severity] || 0), 0),
      }))
      .sort((left, right) => right.count - left.count || right.severityWeight - left.severityWeight || left.file.localeCompare(right.file))
      .slice(0, 10)
      .map((entry) => ({
        file: entry.file,
        domains: entry.domains,
        count: entry.count,
        assessment: assessmentForHotspot(entry),
      }));

    const topFindings = (consolidated.top_findings || [])
      .map((finding) => {
        const evidence = finding.evidence?.[0] || {};
        return {
          id: finding.id,
          severity: finding.severity,
          domain: finding.domain,
          file: evidence.file || "unknown",
          line: evidence.line || null,
          title: finding.title,
          rootCause: rootCauseLookup.get(categoryForFinding(finding)) || "RC-000",
        };
      });

    const domainRows = domainReports.map((report) => ({
      domain: report.domain,
      score: report.score,
      grade: gradeFromScore(report.score),
      findings: report.findings.length,
    }));

    const markdown = [
      "## Inspectra Audit — Tier A (Single-Pass)",
      "",
      `**Score**: ${consolidated.overall_score}/100 | **Grade**: ${consolidated.grade} | **Findings**: ${bySeverity.critical} critical, ${bySeverity.high} high, ${bySeverity.medium} medium, ${bySeverity.low} low`,
      `**Architecture**: Tier A — All tools + 1 LLM synthesis | **Run**: ${formatRunTimestamp(new Date())}`,
      "",
      "### Domain Scores",
      "",
      "| Domain | Score | Grade | Findings |",
      "| -------- | ------- | ------- | ---------- |",
      ...domainRows.map((row) => `| ${row.domain} | ${row.score}/100 | ${row.grade} | ${row.findings} finding${row.findings === 1 ? "" : "s"} |`),
      "",
      "### Root Causes (ranked by impact)",
      "",
      "| # | Root Cause | Affected Domains | Symptom Count | Top Recommendation |",
      "|---|-----------|-----------------|---------------|-------------------|",
      ...rootCauses.map((rootCause, index) => `| ${index + 1} | ${rootCause.title} | ${rootCause.domains.join(", ")} | ${rootCause.symptomCount} | ${rootCause.recommendation} |`),
      "",
      "### Top Findings",
      "",
      "| # | Severity | Domain | File | Title | Root Cause |",
      "| --- | ---------- | -------- | ------ | ------- | ---------- |",
      ...topFindings.map((finding, index) => `| ${index + 1} | ${finding.severity} | ${finding.domain} | ${finding.file}${finding.line ? `:${finding.line}` : ""} | ${finding.title.replace(/\|/g, "\\|")} | ${finding.rootCause} |`),
      "",
      "### Hotspot Files",
      "",
      "| File | Domains | Finding Count | Assessment |",
      "|------|---------|--------------|------------|",
      ...hotspots.map((hotspot) => `| ${hotspot.file} | ${hotspot.domains.join(", ")} | ${hotspot.count} | ${hotspot.assessment} |`),
      "",
      "### Summary",
      `${rootCauses.length > 0 ? `${rootCauses[0].title} is the dominant issue pattern, with ${rootCauses[0].symptomCount} related findings spanning ${rootCauses[0].domains.join(", ")}.` : "No root-cause clusters were identified from deterministic findings."} The highest-risk areas are the files that recur across multiple findings, especially where security or maintainability issues compound on the same class. Domains with zero findings still scored 100 here because the deterministic Tier A sweep found no evidence for those rule sets in this fixture.`,
      "",
    ].join("\n");

    const summary = {
      target: targetName,
      projectDir: targetDir,
      profile,
      generatedAt: now,
      overallScore: consolidated.overall_score,
      overallGrade: consolidated.grade,
      severityCounts: bySeverity,
      domainScores: domainRows,
      rootCauses,
      topFindings,
      hotspots,
      toolResults,
      consolidatedReportPath: join(inspectraDir, "consolidated-report.json"),
      markdownReportPath: join(inspectraDir, "tier-a-report.md"),
      summaryPath: join(inspectraDir, "tier-a-summary.json"),
    };

    await writeFile(join(inspectraDir, "tier-a-report.md"), markdown, "utf8");
    await writeFile(join(inspectraDir, "tier-a-summary.json"), JSON.stringify(summary, null, 2), "utf8");

    console.log(JSON.stringify(summary, null, 2));
  } finally {
    await client.close();
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.stack || error.message : String(error));
  process.exit(1);
});
