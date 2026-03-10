import { readFile } from "node:fs/promises";
import { relative, extname } from "node:path";
import type { Finding } from "../types.js";
import { collectAllFiles } from "../utils/files.js";
import { createIdSequence } from "../utils/id.js";

const TEST_FILE_PATTERN = /\.(test|spec)\.(ts|js)$|Test\.java$/;
const SUPPORTED_EXTENSIONS = new Set([".ts", ".js", ".java"]);

/**
 * Regex that matches at least one real assertion in the file.
 * Covers Jest/Vitest (expect, toBe, toEqual…), Jasmine (expect), and JUnit (assertTrue/assertEquals/assertThat).
 */
const ASSERTION_PATTERN =
  /\b(expect\s*\(|assert\s*\(|\.should\b|assertTrue|assertEquals|assertThrows|assertThat|verify\s*\()/;

/** Matches mock setup calls (Jest/Vitest/Mockito). */
const MOCK_SETUP_PATTERN = /\b(jest\.mock|vi\.mock|jest\.spyOn|vi\.spyOn|Mockito\.mock|Mockito\.when|when\()\b/g;

/** Any `it(...)` / `test(...)` / `@Test` marker — confirms the file has test structure. */
const TEST_BLOCK_PATTERN = /\b(it|test)\s*\(|@Test\b/;

/** Test blocks that use `skip` / `xit` / `test.skip` are intentionally skipped — exclude them. */
const SKIP_PATTERN = /\b(xit|xtest|it\.skip|test\.skip|describe\.skip|@Ignore)\b/;

/** Assertions in Java / JUnit. */
const JAVA_ASSERTION =
  /(\bassert\w+\s*\(|\bverify\s*\(|\bassertThat\s*\(|\.andExpect\s*\(|\bexpect\s*\()/g;

/** @SpringBootTest on Java test classes. */
const SPRING_BOOT_TEST = /@SpringBootTest\b/;

/** Lighter slice annotations that should be preferred. */
const SLICE_TEST_ANNOTATIONS =
  /@WebMvcTest|@WebFluxTest|@DataJpaTest|@RestClientTest|@JsonTest|@JdbcTest\b/;

const EXCESSIVE_ASSERTION_THRESHOLD = 25;

/**
 * Analyzes test files for two common quality issues:
 * 1. Tests that have no assertion statements (they always pass regardless of behavior).
 * 2. Test files that have significantly more mock setups than assertions.
 *
 * Uses regex heuristics — no AST required.
 * Source: "tool", confidence ≤ 0.75 per governance rules.
 */
export async function checkTestQuality(projectDir: string): Promise<Finding[]> {
  const files = await collectAllFiles(projectDir);
  const testFiles = files.filter(
    (f) => SUPPORTED_EXTENSIONS.has(extname(f)) && TEST_FILE_PATTERN.test(f),
  );

  const findings: Finding[] = [];
  const nextId = createIdSequence("TST", 250);

  for (const filePath of testFiles) {
    try {
      const content = await readFile(filePath, "utf-8");
      const relPath = relative(projectDir, filePath);

      const hasTestBlocks = TEST_BLOCK_PATTERN.test(content);
      const isAllSkipped = !SKIP_PATTERN.test(content) ? false : !TEST_BLOCK_PATTERN.test(content.replace(SKIP_PATTERN, ""));

      // Empty-assertion check: test file has test blocks but zero assertion calls
      if (hasTestBlocks && !isAllSkipped && !ASSERTION_PATTERN.test(content)) {
        findings.push({
          id: nextId(),
          severity: "medium",
          title: `Test file with no assertions: ${relPath}`,
          description:
            "This test file contains test blocks but no assertion statements (expect/assert/verify). " +
            "Tests without assertions always pass, providing false confidence.",
          domain: "tests",
          rule: "empty-assertion",
          confidence: 0.75,
          evidence: [{ file: relPath }],
          recommendation: "Add meaningful assertions that verify the expected behavior of the subject under test.",
          effort: "small",
          tags: ["test-quality", "missing-assertion"],
          source: "tool",
        });
      }

      // Excessive-mocking check: more than 2× as many mock setups as assertions
      const mockCount = (content.match(MOCK_SETUP_PATTERN) ?? []).length;
      const assertCount = content.match(ASSERTION_PATTERN) ? 1 : 0;

      // Need a minimum of mock calls to be meaningful
      if (mockCount >= 5 && assertCount === 0) {
        findings.push({
          id: nextId(),
          severity: "low",
          title: `Excessive mocking without assertions: ${relPath}`,
          description:
            `This test file has ${mockCount} mock setup calls but no detected assertion statements. ` +
            "Heavy mocking without assertions produces tests that verify implementation details rather than behavior.",
          domain: "tests",
          rule: "excessive-mocking",
          confidence: 0.60,
          evidence: [{ file: relPath, snippet: `mock_calls=${mockCount}` }],
          recommendation:
            "Add explicit assertions on observable outcomes. Consider whether mocks are necessary or if tests can use real collaborators.",
          effort: "medium",
          tags: ["test-quality", "mocking", "over-mocking"],
          source: "tool",
        });
      }

      // Excessive assertions per test file (Java — .andExpect sprawl)
      if (filePath.endsWith(".java")) {
        const javaAssertMatches = content.match(JAVA_ASSERTION) ?? [];
        const testMethodCount = (content.match(/@Test\b/g) ?? []).length;
        if (testMethodCount > 0 && javaAssertMatches.length / testMethodCount > EXCESSIVE_ASSERTION_THRESHOLD) {
          findings.push({
            id: nextId(),
            severity: "medium",
            title: `Brittle tests: ${Math.round(javaAssertMatches.length / testMethodCount)} assertions/test in ${relPath}`,
            description:
              `This test file averages ${Math.round(javaAssertMatches.length / testMethodCount)} assertions per test method ` +
              `(${javaAssertMatches.length} total across ${testMethodCount} tests). ` +
              "Tests with too many assertions are brittle — any field change breaks them.",
            domain: "tests",
            rule: "excessive-assertions",
            confidence: 0.75,
            evidence: [{ file: relPath, snippet: `assertions=${javaAssertMatches.length}, tests=${testMethodCount}` }],
            recommendation:
              "Split large test methods into focused tests that verify one concept each. " +
              "Use custom assertion helpers or AssertJ's recursive comparison for complex objects.",
            effort: "medium",
            tags: ["test-quality", "brittle-tests", "assertions"],
            source: "tool",
          });
        }
      }

      // @SpringBootTest without slice annotations (heavy integration tests)
      if (filePath.endsWith(".java") && SPRING_BOOT_TEST.test(content) && !SLICE_TEST_ANNOTATIONS.test(content)) {
        findings.push({
          id: nextId(),
          severity: "low",
          title: `@SpringBootTest without test slicing: ${relPath}`,
          description:
            "This test uses @SpringBootTest which loads the full application context (database, messaging, etc.). " +
            "For controller or repository tests, use sliced annotations (@WebMvcTest, @DataJpaTest) for faster, more isolated tests.",
          domain: "tests",
          rule: "missing-test-slicing",
          confidence: 0.70,
          evidence: [{ file: relPath }],
          recommendation:
            "Use @WebMvcTest for controller tests, @DataJpaTest for repository tests, " +
            "or @RestClientTest for REST client tests. Reserve @SpringBootTest for true integration tests.",
          effort: "medium",
          tags: ["test-quality", "spring-boot", "test-slicing", "performance"],
          source: "tool",
        });
      }
    } catch {
      /* skip unreadable files */
    }
  }

  return findings;
}
