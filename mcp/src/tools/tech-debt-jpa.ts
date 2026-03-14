import { readFile } from "node:fs/promises";
import { relative, extname, basename } from "node:path";
import type { Finding } from "../types.js";
import { collectAllFiles } from "../utils/files.js";
import { createIdSequence } from "../utils/id.js";

const JAVA_EXTENSION = ".java";
const ENTITY_ANNOTATION = /@Entity\b/;
const DATA_ANNOTATION = /@Data\b/;
const CASCADE_ALL_PATTERN = /CascadeType\.ALL/;
const MANY_TO_ONE_PATTERN = /@ManyToOne/;
const VERSION_ANNOTATION = /@Version\b/;
const QUERY_MUTATION =
  /@Query\s*\([^)]*(?:UPDATE|DELETE|INSERT)\b/i;
const MODIFYING_ANNOTATION = /@Modifying\b/;
const LAZY_SELF_INJECTION =
  /@Lazy\s+(?:@Autowired|private)\s+\w+\s+\w+|@Autowired\s+@Lazy\s+\w+\s+\w+/;

const MAX_SNIPPET = 120;

/**
 * Detects common JPA and Spring anti-patterns in Java entity/repository files:
 * - `@Data` (Lombok) on `@Entity` classes
 * - `CascadeType.ALL` on `@ManyToOne` relationships
 * - Missing `@Version` for optimistic locking
 * - Missing `@Modifying` on `@Query` UPDATE/DELETE
 * - `@Lazy` self-injection (circular dependency workaround)
 */
export async function detectJpaAntiPatterns(projectDir: string): Promise<Finding[]> {
  const findings: Finding[] = [];
  const nextId = createIdSequence("DEBT", 400);

  const files = await collectAllFiles(projectDir);
  const javaFiles = files.filter((f) => extname(f) === JAVA_EXTENSION);

  const entityFiles: Array<{ relPath: string; content: string }> = [];

  for (const filePath of javaFiles) {
    try {
      const content = await readFile(filePath, "utf-8");
      const relPath = relative(projectDir, filePath);

      if (ENTITY_ANNOTATION.test(content)) {
        entityFiles.push({ relPath, content });
      }

      checkLazySelfInjection(content, relPath, findings, nextId);
      checkMissingModifying(content, relPath, findings, nextId);
    } catch { /* skip */ }
  }

  for (const { content, relPath } of entityFiles) {
    checkDataOnEntity(content, relPath, findings, nextId);
    checkCascadeAllOnManyToOne(content, relPath, findings, nextId);
    checkMissingVersion(content, relPath, findings, nextId);
  }

  return findings;
}

function checkDataOnEntity(
  content: string,
  relPath: string,
  findings: Finding[],
  nextId: () => string,
): void {
  if (!DATA_ANNOTATION.test(content)) return;

  const lines = content.split("\n");
  const line = lines.findIndex((l) => DATA_ANNOTATION.test(l));

  findings.push({
    id: nextId(),
    severity: "high",
    title: `@Data on JPA entity: ${relPath}`,
    description:
      "@Data (Lombok) on a JPA @Entity generates equals(), hashCode(), and toString() on ALL fields, " +
      "including lazy-loaded relationships. This triggers unintended lazy loading, " +
      "LazyInitializationException outside sessions, and StackOverflowError on bidirectional toString().",
    domain: "tech-debt",
    rule: "jpa-data-on-entity",
    confidence: 0.95,
    evidence: [{ file: relPath, line: line >= 0 ? line + 1 : 1 }],
    recommendation:
      "Replace @Data with @Getter and @Setter. Implement equals()/hashCode() manually using " +
      "business keys or entity ID only. Exclude lazy fields from toString().",
    effort: "medium",
    tags: ["jpa", "lombok", "entity", "anti-pattern"],
    source: "tool",
  });
}

function checkCascadeAllOnManyToOne(
  content: string,
  relPath: string,
  findings: Finding[],
  nextId: () => string,
): void {
  if (!MANY_TO_ONE_PATTERN.test(content) || !CASCADE_ALL_PATTERN.test(content)) return;

  const lines = content.split("\n");
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i] ?? "";
    const context = line + " " + (lines[i + 1] ?? "");
    if (MANY_TO_ONE_PATTERN.test(context) && CASCADE_ALL_PATTERN.test(context)) {
      findings.push({
        id: nextId(),
        severity: "high",
        title: `CascadeType.ALL on @ManyToOne: ${relPath}`,
        description:
          "CascadeType.ALL on a @ManyToOne relationship means child operations cascade to the parent. " +
          "Deleting or modifying the child can unintentionally delete/modify the parent entity.",
        domain: "tech-debt",
        rule: "jpa-cascade-all-many-to-one",
        confidence: 0.90,
        evidence: [{ file: relPath, line: i + 1, snippet: line.trim().substring(0, MAX_SNIPPET) }],
        recommendation:
          "Remove CascadeType.ALL from @ManyToOne. Use specific cascades (PERSIST, MERGE) only on " +
          "@OneToMany (parent → children) where it makes semantic sense.",
        effort: "small",
        tags: ["jpa", "cascade", "entity", "anti-pattern"],
        source: "tool",
      });
      break;
    }
  }
}

function checkMissingVersion(
  content: string,
  relPath: string,
  findings: Finding[],
  nextId: () => string,
): void {
  if (VERSION_ANNOTATION.test(content)) return;

  findings.push({
    id: nextId(),
    severity: "medium",
    title: `No @Version for optimistic locking: ${relPath}`,
    description:
      "This JPA entity has no @Version field. Without optimistic locking, " +
      "concurrent updates silently overwrite each other (lost update problem).",
    domain: "tech-debt",
    rule: "jpa-missing-version",
    confidence: 0.80,
    evidence: [{ file: relPath }],
    recommendation:
      "Add a @Version field: @Version private Long version; " +
      "JPA will automatically throw OptimisticLockException on conflicting updates.",
    effort: "small",
    tags: ["jpa", "concurrency", "optimistic-locking"],
    source: "tool",
  });
}

function checkMissingModifying(
  content: string,
  relPath: string,
  findings: Finding[],
  nextId: () => string,
): void {
  const lines = content.split("\n");

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i] ?? "";
    if (!QUERY_MUTATION.test(line)) continue;

    const prevLines = lines.slice(Math.max(0, i - 3), i + 1).join("\n");
    if (MODIFYING_ANNOTATION.test(prevLines)) continue;

    findings.push({
      id: nextId(),
      severity: "medium",
      title: `Missing @Modifying on mutating @Query: ${relPath}`,
      description:
        "A @Query with UPDATE, DELETE, or INSERT requires @Modifying annotation. " +
        "Without it, Spring Data JPA treats it as a SELECT, causing a runtime exception.",
      domain: "tech-debt",
      rule: "jpa-missing-modifying",
      confidence: 0.90,
      evidence: [{ file: relPath, line: i + 1, snippet: line.trim().substring(0, MAX_SNIPPET) }],
      recommendation: "Add @Modifying (and optionally @Transactional) above the @Query annotation.",
      effort: "trivial",
      tags: ["jpa", "spring-data", "repository"],
      source: "tool",
    });
  }
}

function checkLazySelfInjection(
  content: string,
  relPath: string,
  findings: Finding[],
  nextId: () => string,
): void {
  if (!LAZY_SELF_INJECTION.test(content)) return;

  const lines = content.split("\n");
  const line = lines.findIndex((l) => /@Lazy\b/.test(l));

  findings.push({
    id: nextId(),
    severity: "high",
    title: `@Lazy self-injection (circular dependency): ${relPath}`,
    description:
      "@Lazy is used to break a circular dependency at injection time. " +
      "This is a code smell indicating the classes have a bidirectional dependency " +
      "that should be resolved through extraction of shared logic into a separate service.",
    domain: "tech-debt",
    rule: "lazy-self-injection",
    confidence: 0.85,
    evidence: [{ file: relPath, line: line >= 0 ? line + 1 : 1 }],
    recommendation:
      "Extract the shared logic into a dedicated service to break the cycle. " +
      "Alternatively, use event-driven communication or the mediator pattern.",
    effort: "large",
    tags: ["circular-dependency", "spring", "lazy", "anti-pattern"],
    source: "tool",
  });
}

/**
 * Detects JPA/Hibernate projects that have no database migration tool (Liquibase or Flyway).
 * Without schema migration tooling, DDL changes are untracked and deployments are error-prone.
 */
export async function detectMissingMigrationTool(projectDir: string): Promise<Finding[]> {
  const nextId = createIdSequence("DEBT", 450);
  const allFiles = await collectAllFiles(projectDir);
  const javaFiles = allFiles.filter((f) => extname(f) === JAVA_EXTENSION);

  let hasEntities = false;
  for (const f of javaFiles) {
    try {
      const content = await readFile(f, "utf-8");
      if (ENTITY_ANNOTATION.test(content)) {
        hasEntities = true;
        break;
      }
    } catch { /* skip */ }
  }

  if (!hasEntities) return [];

  const hasLiquibase = allFiles.some(
    (f) => /changelog-master\.(xml|ya?ml|json)$/i.test(basename(f)) ||
           /[/\\]db[/\\]changelog[/\\]/i.test(f),
  );
  const hasFlyway = allFiles.some(
    (f) => /[/\\]db[/\\]migration[/\\]/i.test(f) ||
           /^V\d+__.*\.sql$/i.test(basename(f)),
  );

  let buildFileHasMigrationDep = false;
  for (const f of allFiles) {
    const name = basename(f);
    if (name !== "pom.xml" && name !== "build.gradle" && name !== "build.gradle.kts") continue;
    try {
      const content = await readFile(f, "utf-8");
      if (/liquibase|flyway/i.test(content)) {
        buildFileHasMigrationDep = true;
        break;
      }
    } catch { /* skip */ }
  }

  if (hasLiquibase || hasFlyway || buildFileHasMigrationDep) return [];

  return [{
    id: nextId(),
    severity: "medium",
    title: "JPA entities found but no database migration tool detected",
    description:
      "The project uses JPA @Entity classes but neither Liquibase nor Flyway is configured. " +
      "Without a migration tool, schema changes are untracked, making rollbacks and team collaboration risky. " +
      "Relying on hibernate.ddl-auto=update in production leads to data loss.",
    domain: "tech-debt",
    rule: "jpa-no-migration-tool",
    confidence: 0.85,
    evidence: [{ file: "pom.xml", snippet: "No liquibase/flyway dependency found" }],
    recommendation:
      "Add Liquibase or Flyway to your build (e.g. spring-boot-starter-liquibase). " +
      "Create an initial changelog from your current schema, then track all DDL changes as versioned migrations.",
    effort: "medium",
    tags: ["jpa", "database", "migration", "liquibase", "flyway"],
    source: "tool",
  }];
}
