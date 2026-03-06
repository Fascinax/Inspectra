# Tests Quality Audit — Reference Material

> This file is the authoritative reference companion for the `audit-tests` agent.
> It contains testing principles, antipattern catalogs, coverage thresholds, and stack-aware detection strategies.
> The agent file (`.github/agents/audit-tests.agent.md`) points here for full details.

---

## External References

### Books

| Title | Author(s) | Year | ISBN / Link |
| ------- | ----------- | ------ | ------------- |
| xUnit Test Patterns: Refactoring Test Code | Gerard Meszaros | 2007 | 978-0131495050 |
| The Art of Unit Testing (3rd ed.) | Roy Osherove | 2023 | 978-1718502680 |
| Working Effectively with Unit Tests | Jay Fields | 2014 | 978-1941222294 |
| Test Driven Development: By Example | Kent Beck | 2002 | 978-0321146533 |
| Clean Code: A Handbook of Agile Software Craftsmanship | Robert C. Martin | 2008 | 978-0132350884 |
| Growing Object-Oriented Software, Guided by Tests | Freeman & Pryce | 2009 | 978-0321503626 |
| Continuous Delivery | Humble & Farley | 2010 | 978-0321601919 |

### Community Resources

| Resource | Maintainer | URL |
| --------- | ----------- | ----- |
| testsmells.org — Test Smell Catalog | Andrea Virgilio | <https://testsmells.org/> |
| Martin Fowler — Test Pyramid | Martin Fowler | <https://martinfowler.com/bliki/TestPyramid.html> |
| Practical Test Pyramid | Ham Vocke / Martin Fowler | <https://martinfowler.com/articles/practical-test-pyramid.html> |
| Kent C. Dodds — Testing Trophy | Kent C. Dodds | <https://kentcdodds.com/blog/the-testing-trophy-and-testing-classifications> |
| Kent C. Dodds — Write Tests | Kent C. Dodds | <https://kentcdodds.com/blog/write-tests> |
| Playwright Best Practices | Microsoft | <https://playwright.dev/docs/best-practices> |
| Testing Library Principles | Kent C. Dodds | <https://testing-library.com/docs/guiding-principles> |

### Standards & Style Guides

| Standard / Resource | Maintainer | URL |
| --------------------- | ------------ | ----- |
| ISTQB Standard Glossary | ISTQB | <https://glossary.istqb.org/> |
| IEEE 829 — Standard for Test Documentation | IEEE | <https://standards.ieee.org/ieee/829/4040/> |
| OWASP ASVS v4 — §V1.7 (Test Coverage) | OWASP | <https://owasp.org/www-project-application-security-verification-standard/> |
| SonarQube Quality Gates (Sonar Way, 2024) | SonarSource | <https://docs.sonarsource.com/sonarqube/latest/user-guide/quality-gates/> |
| Google Testing Blog — Test Sizes | Google Engineering | <https://testing.googleblog.com/2010/12/test-sizes.html> |
| JUnit 5 User Guide | JUnit Team | <https://junit.org/junit5/docs/current/user-guide/> |
| Vitest Documentation | Vitest Team | <https://vitest.dev/guide/> |
| Jest Documentation | Meta / OpenJS | <https://jestjs.io/docs/getting-started> |

### Research & Metrics

| Source | Key Finding | URL |
| -------- | ------------- | ----- |
| Google Testing Blog (2016) | Async timing assumptions = #1 source of flakiness | <https://testing.googleblog.com/2016/05/flaky-tests-at-google-and-how-we.html> |
| Netflix Engineering | 73% of flaky tests stem from async timing | <https://netflixtechblog.com/> |
| Spotify Engineering | 38% of intermittent failures from shared mutable state | <https://engineering.atspotify.com/> |
| SonarQube Sonar Way (2024) | 80% new-code coverage is the default quality gate | <https://docs.sonarsource.com/sonarqube/latest/> |
| ISO 25010 / SQALE | Debt ratio A: 0–5%, F: >50% | <https://www.iso.org/standard/35733.html> |
| NIST SP 800-53 SA-11 | Security-critical paths: 100% coverage required | <https://csrc.nist.gov/publications/detail/sp/800-53/rev-5/final> |

---

## Testing Principles

### Test Pyramid (Mike Cohn / Martin Fowler)

| Level | Characteristics | Target share |
| ------- | ---------------- | ------------- |
| Unit tests | Fast (<1s), isolated, mock at boundaries | ~70% of test suite |
| Integration tests | Real DB/HTTP, narrow scope, no UI | ~20% of test suite |
| E2E tests | Full user workflow, browser/API | ~10% of test suite |

**Ice cream cone antipattern**: E2E tests > unit tests. Signals a fundamentally inverted pyramid.

**Testing Trophy (Kent C. Dodds)** variant: emphasizes integration tests as majority, with static analysis replacing some unit tests. Both prescribe the same principle — don't rely on E2E for logic verification.

### FIRST Principles (Robert C. Martin / Brett Schuchert)

| Letter | Principle | Violation signal |
| -------- | ---------- | ---------------- |
| **F** — Fast | No real HTTP, DB, or file I/O in unit tests | `fetch(`, `axios.get(`, `pg.query(` without mock |
| **I** — Isolated | No shared mutable state between tests | `let x =` at module scope, no `beforeEach` reset |
| **R** — Repeatable | No wall-clock, random, or env dependencies | `Date.now()`, `Math.random()`, `process.env.X` without mock |
| **S** — Self-validating | Every test must assert something | 0 `expect()` calls, `console.log` validation |
| **T** — Timely | Tests written proactively, not retroactively | Test file created >14 days after production file |

---

## Coverage Thresholds

### By Metric Type

| Metric | Critical | High | Medium | Source |
| -------- | -------- | ----- | ------- | ------- |
| Line coverage | < 20% | < 50% | < 80% (new code) | Google; SonarQube |
| Branch/condition coverage | < 40% | < 60% | < 70% | SonarQube; IEEE 829 |
| Function coverage | < 40% | < 60% | < 80% | Istanbul/NYC defaults |
| Security-critical path coverage | < 100% | < 100% | — | OWASP ASVS v4 §V1.7 |
| Auth/authz path coverage | < 100% | < 100% | — | OWASP ASVS v4 §V2, §V4 |

> **Key insight:** 100% line coverage with 0% branch coverage is deceptive. A function with an `if`/`else` can be executed once (line = 100%) while the `else` branch is never taken (branch = 0%). Always require branch coverage thresholds alongside line coverage.

### SonarQube Sonar Way (2024 defaults)

| Condition | Gate Threshold |
| ---------- | -------------- |
| Coverage on new code | ≥ **80%** |
| Duplicated lines on new code | < **3%** |
| Maintainability rating | **A** |
| Reliability rating | **A** |
| Security rating | **A** |
| Security Hotspots reviewed | **100%** |

### Test-to-Source Ratio

| Ratio | Meaning | Severity |
| ------- | -------- | -------- |
| ≥ 1.5 | Excellent — TDD discipline | `info` |
| 1.0–1.49 | Good — parity reached | `info` |
| 0.7–0.99 | Acceptable — minor gaps | `low` |
| 0.5–0.69 | Concerning — systematic gaps | `medium` |
| < 0.5 | Critical test deficit | `high` |

---

## xUnit Antipatterns Catalog (Gerard Meszaros)

Source: *xUnit Test Patterns* (2007), testsmells.org

### Test Code Smells

| Smell | Inspectra ID | Description | Detection Signal |
| ------- | ------------- | ----------- | ---------------- |
| **Mystery Guest** | `TST-510` | Test relies on external fixture (file, DB row, env var) not visible in body | References `file:`, reads from fixture dir, reads env var not set in test |
| **Assertion Roulette** | `TST-511` | ≥3 assertions with no descriptive messages | `expect()` ×3+ with no `.message` or description parameter |
| **Eager Test** | `TST-512` | Single test calls ≥3 distinct production methods | Multiple SUT method calls in one `it()` block |
| **Conditional Test Logic** | `TST-513` | `if`, `switch`, `for`, `while` inside test body | Control flow inside test function |
| **Happy Path Only** | `TST-514` | Suite has zero tests covering error/null/edge paths | No keyword `error`, `fail`, `null`, `empty`, `invalid` in test names |
| **Empty / Incomplete Test** | `TST-515` | Test body is empty or comments-only | Zero executable statements in test body |
| **Redundant Assertion** | `TST-516` | `assertTrue(true)`, `expect(x).toBe(x)` — always true | Same literal on both sides of assertion |
| **Sensitive Equality** | `TST-517` | Asserting on `.toString()` output | `expect(obj.toString()).toBe(...)` |
| **Magic Number in Assertion** | `TST-518` | Unexplained numeric literal as expected value | `expect(result).toBe(42)` with no named constant |
| **Ignored / Skipped Test** | `TST-519` | Test permanently disabled | `@Disabled`, `@Ignore`, `xit(`, `test.skip(`, `it.skip(` |
| **General Fixture** | `TST-520` | `beforeEach` initializes variables many tests don't use | >3 vars in `beforeEach`, not all referenced per test |

### Arrange-Act-Assert Violations

| Violation | Inspectra ID | Detection Signal |
| ---------- | ------------- | ---------------- |
| **Multiple Act phases** | `TST-521` | 2+ SUT invocations with assertions interleaved |
| **Assert Before Act** | `TST-522` | `expect()` appears before SUT call |
| **No separation of AAA phases** | `TST-523` | ≥5 statements with no blank-line breaks |

---

## Flaky Test Patterns

Source: Google Testing Blog, Netflix/Spotify Engineering, testsmells.org

### Timing Dependencies

| Antipattern | Detection Regex | Severity |
| ------------ | --------------- | -------- |
| `Thread.sleep` in Java test | `/Thread\.sleep\s*\(\d+\)/` | `high` |
| `setTimeout` as sync primitive | `/await\s+new\s+Promise\s*\([^)]*setTimeout/` | `high` |
| Playwright `waitForTimeout` (hard wait) | `/page\.waitForTimeout\s*\(\s*\d+/` | `medium` |
| Cypress hard integer wait | `/cy\.wait\s*\(\s*\d{3,}/` | `medium` |
| `sleep()` helper function | `/(?:const\|function)\s+sleep\s*=.*setTimeout/` | `medium` |

**Fix pattern (JS/TS):** Replace `setTimeout` sync with `waitFor(() => ...)` (Testing Library) or `page.waitForSelector(...)` (Playwright).  
**Fix pattern (Java):** Replace `Thread.sleep(n)` with `Awaitility.await().atMost(5, SECONDS).until(...)`.

### Shared State

| Antipattern | Detection Signal | Severity |
| ------------ | ---------------- | -------- |
| Module-level mutable `let`/`var` | `let x =` declared outside test functions | `high` |
| `global.X` assignment | `/global\.\w+\s*=/` in test file | `high` |
| `@BeforeAll` populating mutable list/map | `@BeforeAll` + `List<`/`Map<` without `@BeforeEach` reset | `medium` |
| No teardown after setup | `beforeEach` creates resource, no `afterEach` cleanup | `medium` |

### Non-Determinism

| Antipattern | Detection Regex | Severity |
| ------------ | --------------- | -------- |
| `Date.now()` in assertion value | `/(?:toBe\|toEqual)\s*\([\s\S]*?Date\.now/` | `high` |
| `Math.random()` in assertion | `/expect\s*\([\s\S]*?Math\.random/` | `high` |
| Asserting unordered collection | `/expect\(.*(?:Object\.keys\|new Set\|new Map)[\s\S]*?\)\.toEqual\(/` | `medium` |
| `new Date()` as expected value | `/(?:toBe\|toEqual)\s*\(\s*new Date\s*\(\s*\)/` | `medium` |

### Resource Leaks

| Antipattern | Detection Signal | Severity |
| ------------ | ---------------- | -------- |
| `http.createServer()` without `.close()` | `createServer` with no corresponding `close()` in same file | `high` |
| Hardcoded port number | `/listen\s*\(\s*\d{4,5}/` — use `:0` for random port | `medium` |
| `forceExit: true` in Jest config | Masks open handle warnings | `medium` |

---

## Framework-Specific Rules

### TypeScript / JavaScript (Jest / Vitest)

| Rule | Pattern | Severity |
| ----- | ------- | -------- |
| `jest.resetAllMocks()` missing in `afterEach` | Heavy `jest.mock` usage without reset lifecycle | `medium` |
| `fireEvent` instead of `userEvent` (Testing Library) | `fireEvent.click(` / `fireEvent.change(` in React tests | `low` |
| Async test without `await` | `it('...', async () => { somePromise() })` — no `await` | `high` |
| `expect.assertions(n)` missing in async tests | No `expect.assertions()` guard in async test body | `medium` |
| Snapshot overuse | File has >5 `toMatchSnapshot()` calls | `medium` |
| Volatile data in inline snapshot | Snapshot contains `id:`, `createdAt:`, or UUID pattern | `high` |
| `console.log` as assertion substitute | All `console.log` and zero `expect()` | `high` |

**Recommended setup lifecycle:**
```ts
beforeEach(() => {
  jest.resetAllMocks(); // reset call counts + return values
});
afterEach(() => {
  jest.restoreAllMocks(); // restore original implementations
});
```

### Java (JUnit 5 / Mockito)

| Rule | Signal | Severity |
| ----- | ------ | -------- |
| `PowerMock` usage (design smell) | `import org.powermock` | `medium` |
| `@BeforeAll` with mutable shared data | `@BeforeAll` + `static List/Map/Set` field mutated in tests | `medium` |
| `@Test(expected=...)` instead of `assertThrows` | Old JUnit 4 pattern in JUnit 5 suite | `low` |
| `assertEquals(expected, actual)` wrong order | Developers inverting args — error message is misleading | `low` |
| `@Ignore` without expiry comment | Disabled test with no TODO tracking removal | `medium` |

**Fix — PowerMock:** PowerMock is needed when production code uses `static` methods or `final` classes that can't be injected. Its presence signals the production code violates Dependency Injection. Fix the production code, not the test.

### Playwright (E2E)

| Rule | Signal | Severity |
| ----- | ------ | -------- |
| No Page Object Model | No `.page.ts` class files alongside spec files | `medium` |
| Direct locator in test body | `page.locator(`, `page.fill(` directly inside `test()` | `low` |
| Brittle CSS selector | `page.locator('.btn-primary')` without `data-testid` | `medium` |
| `waitForTimeout` hard wait | `page.waitForTimeout(2000)` instead of smart wait | `high` |
| Missing `baseURL` in config | Full URL hardcoded in tests, not using `playwright.config.ts` `baseURL` | `medium` |
| Shared auth state not isolated | Login in `beforeAll`, no fresh context per test | `medium` |
| No `test.describe` grouping | All tests in flat `test()` with no logical grouping | `low` |

**Preferred selectors (Playwright):**  
`getByRole(...)` > `getByTestId(...)` > `getByLabel(...)` > `getByText(...)` > CSS selector (last resort).

---

## Test Naming Conventions

Source: Roy Osherove *Art of Unit Testing*, BDD specification by example (Dan North 2003)

### Naming Antipatterns

| Smell | Pattern | Example | Severity |
| ----- | ------- | ------- | -------- |
| Generic/meaningless name | `/^(test\d*\|myTest\|temp\|foo\|bar\|test_1)$/i` | `test1()`, `myTest()` | `medium` |
| Name is method name only | Same as the function being tested, nothing more | `testCreateUser()` | `low` |
| Abbreviation-only | Very short name without semantic meaning | `tst()`, `chk()` | `low` |
| Describe block is empty/generic | `""`, `"test"`, `"suite"`, `"tests"` | `describe('tests', ...)` | `low` |

### Naming Conventions by Language

| Language | Preferred Convention | Good Example |
| --------- | -------------------- | ------------ |
| Java (JUnit 5) | `shouldWhen` camelCase + `@DisplayName` | `@DisplayName("should return null when input is empty")` |
| TypeScript/JavaScript (Jest/Vitest) | Natural language string | `it("returns an empty array when no items match the filter")` |
| Python (pytest) | `snake_case` + BDD vocabulary | `def test_should_raise_when_amount_is_negative():` |
| Kotlin (Kotest) | Backtick natural language | `` `should throw when amount is negative` `` |

### BDD Pattern (Given-When-Then)

```
"given [precondition] when [action] then [expected outcome]"
```

Examples:
- `"given a valid user when creating then returns 201 with user id"`
- `"given null input when calculating discount then throws IllegalArgumentException"`
- `shouldReturnZeroWhenInputIsNull` (Java camelCase equivalent)

---

## Coverage Quality vs. Quantity

### Key Distinctions

**Line coverage** — was this line executed? Highest risk of false confidence.  
**Branch coverage** — was each `true`/`false` side of every conditional hit? More meaningful.  
**Mutation score** (Stryker/Pitest) — did flipping each operator cause at least one test to fail? Most meaningful.

### Coverage Quality Rules

| Rule | Detection | Severity |
| ----- | --------- | -------- |
| 100% lines, <50% branches | Coverage artifact shows line ≥ 95%, branch < 50% | `high` |
| Untested `catch`/`else`/`default` | Production `try/catch` with no test triggering the `catch` path | `medium` |
| Coverage padding — assert-free tests | Tests execute code but have zero meaningful assertions | `high` |
| Missing boundary value tests | `>`, `>=`, `===0` in production code, no test at `n-1`, `n`, `n+1` | `medium` |
| Mutation score < 60% | Stryker/Pitest report present with low mutation score | `medium` |
| No null/undefined input test | Optional param in signature — no test passes `null`/`undefined` | `medium` |
| Coverage exclusion abuse | `/* istanbul ignore next */` on business logic (not generated code) | `high` |

---

## Inspectra Rule Mapping

### Phase 1 — Tool-Detected (source: "tool", confidence ≥ 0.8, IDs 001–249)

| TST ID | Rule | Severity | Tool |
| ------- | ----- | -------- | ---- |
| `TST-001..010` | Coverage thresholds (line/branch/function) | `critical`/`high`/`medium` | `inspectra_parse_coverage` |
| `TST-011..020` | Test failures, retry > 2 | `critical`/`high` | `inspectra_parse_test_results` |
| `TST-021..040` | Missing test files for source files | `high`/`medium` | `inspectra_detect_missing_tests` |
| `TST-041..060` | E2E failures, retries, duration outliers | `high`/`medium` | `inspectra_parse_playwright_report` |
| `TST-061..099` | Flaky patterns (sleep, retry wrapper) | `high`/`medium` | `inspectra_detect_flaky_tests` |
| `TST-100..249` | Empty assertions, excessive mocking | `high`/`medium` | `inspectra_check_test_quality` |

### Phase 2 — LLM-Detected (source: "llm", confidence ≤ 0.7, IDs 501+)

| TST ID | Rule | Severity |
| ------- | ----- | -------- |
| `TST-501` | Shallow assertion — result only checked for truthiness | `medium` |
| `TST-502` | Missing error-path coverage | `medium` |
| `TST-503` | Fragile snapshot — contains volatile data | `medium` |
| `TST-504` | Async test without `await`/`return` | `high` |
| `TST-505` | Module-level mutable state — shared between tests | `high` |
| `TST-506` | Real HTTP call in unit test (no MSW/nock/WireMock) | `high` |
| `TST-507` | `Thread.sleep` / `setTimeout` as sync primitive | `high` |
| `TST-508` | Undefined/null input never passed to function under test | `medium` |
| `TST-509` | Test named generically (`test1`, `myTest`, `temp`) | `medium` |
| `TST-510` | Mystery Guest — fixture dependency invisible in body | `medium` |
| `TST-511` | Assertion Roulette — ≥3 asserts, no messages | `low` |
| `TST-512` | Eager Test — tests multiple production methods | `low` |
| `TST-513` | Conditional Test Logic — `if`/`for` inside test body | `medium` |
| `TST-514` | Happy Path Only — no error/edge tests in suite | `medium` |
| `TST-515` | Empty / Incomplete test body | `high` |
| `TST-516` | Redundant Assertion — always true | `low` |
| `TST-517` | Sensitive Equality — asserting `.toString()` | `low` |
| `TST-518` | Magic Number in assertion | `low` |
| `TST-519` | Skipped test — `@Disabled`/`xit`/`test.skip` | `medium` |
| `TST-520` | General Fixture — `beforeEach` over-initializes | `low` |
| `TST-521` | Multiple Act phases in single test | `medium` |
| `TST-522` | Assert before Act | `medium` |
| `TST-523` | Missing coverage on boundary values (n−1, n, n+1) | `medium` |
| `TST-524` | Coverage exclusion abuse (`istanbul ignore`) | `high` |
| `TST-525` | PowerMock usage — signals testability flaw in production code | `medium` |
| `TST-526` | Playwright: `waitForTimeout` hard wait | `high` |
| `TST-527` | Playwright: brittle CSS selector (no `data-testid`) | `medium` |
| `TST-528` | Playwright: no Page Object Model for >5 specs | `medium` |
| `TST-529` | Snapshot overuse — >5 `toMatchSnapshot()` in one file | `medium` |
| `TST-530` | Volatile data in inline snapshot (IDs, timestamps) | `high` |

---

## Confidence Calibration Guide

| Range | Meaning | When to use |
| ------- | -------- | ----------- |
| `0.90–1.00` | Tool-confirmed; near-certain | Phase 1 only (`source: "tool"`) |
| `0.80–0.89` | High structural confidence | Phase 1 (tool with good coverage patterns) |
| `0.65–0.70` | Clear structural antipattern visible in code | Phase 2 — empty test, obvious flaky pattern |
| `0.55–0.64` | Probable issue — requires reading production code | Phase 2 — shallow assertion, missing error path |
| `0.40–0.54` | Heuristic — depends on business-rule knowledge | Phase 2 — missing edge case, AAA style violation |

---

## Composite Scoring Model

| Score | Grade | Criteria |
| ----- | ----- | -------- |
| 90–100 | A | Coverage ≥ 80% line + ≥ 70% branch, ratio ≥ 1.0, no missing tests on critical paths, no assertion-free tests |
| 75–89 | B | Coverage 70–79% line, ratio ≥ 0.7, minor naming issues, some missing edge-case tests |
| 60–74 | C | Coverage 60–69%, some uncovered public APIs, assertion smells detected |
| 40–59 | D | Coverage 40–59%, ratio < 0.5, assertion smell count > 10, flaky tests present |
| < 40 | F | Coverage < 40%, systematic absence of tests, zero-assertion tests throughout |
