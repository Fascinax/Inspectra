# Conventions & Clean Code Audit — Reference Material

> This file is the authoritative reference companion for the conventions audit workflow.
> It contains clean code principles, code smell catalogs, rule mappings, and stack-aware detection strategies.
> Prompt workflows and audit documentation point here for full details.

---

## External References

### Books

| Title | Author(s) | Year | ISBN / Link |
| ------- | ----------- | ------ | ------------- |
| Clean Code: A Handbook of Agile Software Craftsmanship | Robert C. Martin | 2008 | 978-0132350884 |
| The Clean Coder: A Code of Conduct for Professional Programmers | Robert C. Martin | 2011 | 978-0137081073 |
| Clean Architecture: A Craftsman's Guide to Software Structure and Design | Robert C. Martin | 2017 | 978-0134494166 |
| Refactoring: Improving the Design of Existing Code (2nd ed.) | Martin Fowler | 2018 | 978-0134757599 |
| Design Patterns: Elements of Reusable Object-Oriented Software | Gang of Four (GoF) | 1994 | 978-0201633610 |
| A Philosophy of Software Design (2nd ed.) | John Ousterhout | 2021 | 978-1732102217 |
| Code Complete (2nd ed.) | Steve McConnell | 2004 | 978-0735619678 |

### Community Repositories

| Repository | Stars | Language | URL |
| ------------ | ------- | ---------- | ----- |
| clean-code-javascript | 94k+ | JavaScript | <https://github.com/ryanmcdermott/clean-code-javascript> |
| clean-code-typescript | 9.7k+ | TypeScript | <https://github.com/labs42io/clean-code-typescript> |
| clean-code-python | 95k+ | Python | <https://github.com/zedr/clean-code-python> |
| clean-code-java | 3k+ | Java | <https://github.com/leonardolemie/clean-code-java> |
| clean-code-skills (Fascinax) | — | Multi-lang | <https://github.com/Fascinax/clean-code-skills> |
| go-clean-arch | 9k+ | Go | <https://github.com/bxcodec/go-clean-arch> |

### Standards & Style Guides

| Standard / Resource | Maintainer | URL |
| --------------------- | ------------ | ----- |
| Google TypeScript Style Guide | Google | <https://google.github.io/styleguide/tsguide.html> |
| Google Java Style Guide | Google | <https://google.github.io/styleguide/javaguide.html> |
| Google JavaScript Style Guide | Google | <https://google.github.io/styleguide/jsguide.html> |
| Airbnb JavaScript Style Guide | Airbnb | <https://github.com/airbnb/javascript> |
| Angular Coding Style Guide | Angular Team | <https://angular.dev/style-guide> |
| Effective Go | Go Team | <https://go.dev/doc/effective_go> |
| PEP 8 — Style Guide for Python Code | Python.org | <https://peps.python.org/pep-0008/> |
| Rust API Guidelines | Rust Lang | <https://rust-lang.github.io/api-guidelines/> |
| Microsoft C# Coding Conventions | Microsoft | <https://learn.microsoft.com/en-us/dotnet/csharp/fundamentals/coding-style/coding-conventions> |
| ESLint (TypeScript) | typescript-eslint | <https://typescript-eslint.io/> |
| SonarQube Rules | Sonar | <https://rules.sonarsource.com/> |

### Research & Metrics

| Source | Key Finding | URL |
| -------- | ------------- | ----- |
| GitClear (2024) | AI-assisted code shows 4× more code duplication | <https://www.gitclear.com/coding_on_copilot_data_shows_ais_downward_pressure_on_code_quality> |
| Carnegie Mellon SEI | AI code has +30% lint warnings, +41% cyclomatic complexity | <https://insights.sei.cmu.edu/blog/> |
| Google DORA | Elite teams deploy 973× more frequently with 6570× faster lead time | <https://dora.dev/research/> |
| Refactoring.Guru — Code Smells | 22 code smells in 5 categories | <https://refactoring.guru/refactoring/smells> |

---

## Robert C. Martin's Clean Code Rule Catalog

Full catalog from *Clean Code* Chapter 17 / Appendix (sourced from [Fascinax/clean-code-skills](https://github.com/Fascinax/clean-code-skills)):

### Comments (C1–C5)

| ID | Rule | Description |
| ---- | ------ | ------------- |
| C1 | Inappropriate Information | Comments holding metadata belonging to source control (author, date, change history) |
| C2 | Obsolete Comment | Old, irrelevant, or incorrect comment that no longer reflects reality |
| C3 | Redundant Comment | Comment restating what the code already clearly says |
| C4 | Poorly Written Comment | Rambling, poorly worded, or grammatically incorrect comment |
| C5 | Commented‑Out Code | Code left in comments "just in case" — use version control instead |

### Functions (F1–F4)

| ID | Rule | Description |
| ---- | ------ | ------------- |
| F1 | Too Many Arguments | Functions with 3+ arguments — prefer 0–2, use objects for more |
| F2 | Output Arguments | Functions modifying arguments instead of returning — confuses readers |
| F3 | Flag Arguments | Boolean parameters causing function to do multiple things — split into separate functions |
| F4 | Dead Function | Functions never called — remove immediately |

### General (G1–G36)

| ID | Rule | Description |
| ---- | ------ | ------------- |
| G1 | Multiple Languages in One Source File | Mixing HTML, CSS, JS, SQL in a single file without clear separation |
| G2 | Obvious Behavior Not Implemented | Function does not do what its name promises |
| G3 | Incorrect Behavior at Boundaries | Missing edge case handling at boundaries |
| G4 | Overridden Safeties | Disabling compiler warnings, linter rules, or @SuppressWarnings |
| G5 | Duplication (DRY) | Repeated logic that should be abstracted — every duplication is a missed opportunity |
| G6 | Code at Wrong Level of Abstraction | Mixing high-level and low-level detail in the same class/function |
| G7 | Base Classes Depending on Derivatives | Parent classes referencing or knowing about child implementations |
| G8 | Too Much Information | Overly broad interfaces exposing internals — prefer narrow, focused APIs |
| G9 | Dead Code | Unreachable or unused statements — remove ruthlessly |
| G10 | Vertical Separation | Variables and functions defined far from where they are used |
| G11 | Inconsistency | If you do something one way, do similar things the same way everywhere |
| G12 | Clutter | Unused variables, default constructors, unreferenced imports |
| G13 | Artificial Coupling | Dependencies between unrelated modules — coupling should be intentional |
| G14 | Feature Envy | Method uses another class's data more than its own — move it |
| G15 | Selector Arguments | Boolean/enum arguments selecting behavior — split into distinct functions |
| G16 | Obscured Intent | Code written in a way that hides its purpose (clever tricks, dense expressions) |
| G17 | Misplaced Responsibility | Function lives in the wrong class or module |
| G18 | Inappropriate Static | Using static methods when polymorphism would be more flexible |
| G19 | Use Explanatory Variables | Complex expressions broken into named intermediate variables for readability |
| G20 | Function Names Should Say What They Do | Name reveals intent — `addMonthToDate()` not `addToDate()` |
| G21 | Understand the Algorithm | Don't stop coding when tests pass — ensure you truly understand the logic |
| G22 | Make Logical Dependencies Physical | If B depends on A, make that dependency explicit in the code structure |
| G23 | Prefer Polymorphism to If/Else or Switch/Case | Replace repeated conditionals with inheritance and polymorphism |
| G24 | Follow Standard Conventions | Respect the team's coding standard consistently |
| G25 | Replace Magic Numbers with Named Constants | `MILLISECONDS_PER_DAY` not `86400000` |
| G26 | Be Precise | Don't be lazy with decisions — choose the right data type, handle nulls |
| G27 | Structure over Convention | Enforce constraints through compiler/type-system, not just team agreements |
| G28 | Encapsulate Conditionals | `shouldShowSpinner(fsm)` not `if (fsm.state === "loading" && !isEmpty(list))` |
| G29 | Avoid Negative Conditionals | `isActive()` not `isNotDisabled()` |
| G30 | Functions Should Do One Thing | Single Responsibility at the function level |
| G31 | Hidden Temporal Couplings | Make execution order explicit through function signatures |
| G32 | Don't Be Arbitrary | Structure your code for clear reasons, not whim or convenience |
| G33 | Encapsulate Boundary Conditions | `nextLevel = level + 1` at one place, not scattered `level + 1` expressions |
| G34 | Functions Should Descend One Level of Abstraction | Each function calls functions one level below its abstraction |
| G35 | Keep Configurable Data at High Levels | Constants and config at the top, not buried deep in logic |
| G36 | Avoid Transitive Navigation | Law of Demeter — prefer `a.getB()` over `a.getB().getC().getD()` |

### Names (N1–N7)

| ID | Rule | Description |
| ---- | ------ | ------------- |
| N1 | Choose Descriptive Names | Names should reveal intent — take time to pick the right name |
| N2 | Choose Names at the Appropriate Level of Abstraction | Use domain terms, not implementation details |
| N3 | Use Standard Nomenclature Where Possible | Follow language and framework naming conventions |
| N4 | Unambiguous Names | Names that cannot be misinterpreted |
| N5 | Use Long Names for Long Scopes | Short names only for tiny scopes (loop vars), long names for public APIs |
| N6 | Avoid Encodings | No Hungarian notation, no type prefixes (`strName`, `iCount`) |
| N7 | Names Should Describe Side Effects | `createOrReturnOas()` not `getOas()` if it creates on miss |

### Tests (T1–T9)

| ID | Rule | Description |
| ---- | ------ | ------------- |
| T1 | Insufficient Tests | A test suite is incomplete until it tests everything that could possibly break |
| T2 | Use a Coverage Tool | Coverage highlights untested code paths |
| T3 | Don't Skip Trivial Tests | They document behavior and catch regressions |
| T4 | An Ignored Test Is a Question About an Ambiguity | Don't `@skip` without documenting why |
| T5 | Test Boundary Conditions | Boundaries are where bugs live |
| T6 | Exhaustively Test Near Bugs | When you find a bug, write more tests for that area |
| T7 | Patterns of Failure Are Revealing | Failing test patterns often identify root causes |
| T8 | Test Coverage Patterns Can Be Revealing | Coverage gaps reveal architectural blind spots |
| T9 | Tests Should Be Fast | Slow tests don't get run — keep them under 100ms each |

---

## SOLID Principles Reference

Adapted from Clean Code / Clean Architecture, with TS/JS/Java examples from [clean-code-typescript](https://github.com/labs42io/clean-code-typescript) and [clean-code-javascript](https://github.com/ryanmcdermott/clean-code-javascript):

| Principle | Acronym | Rule | Detection Strategy |
| ----------- | --------- | ------ | -------------------- |
| Single Responsibility | **S** | A class should have only one reason to change | Classes with mixed concerns, 5+ public methods spanning different domains |
| Open/Closed | **O** | Open for extension, closed for modification | `instanceof` chains, switch-on-type patterns instead of polymorphism |
| Liskov Substitution | **L** | Subtypes must be substitutable for their base types | Overrides that throw `NotImplementedError`, broken contracts |
| Interface Segregation | **I** | Clients should not depend on interfaces they don't use | Fat interfaces with methods that force empty or throw-only implementations |
| Dependency Inversion | **D** | Depend on abstractions, not concretions | `new ConcreteClass()` inside constructors, no injection |

---

## Code Smells Catalog

Classification from Martin Fowler's *Refactoring* and [Refactoring.Guru](https://refactoring.guru/refactoring/smells):

### Bloaters

| Smell | Signs | Inspectra Detection |
| ------- | ------- | --------------------- |
| Long Method | Method > 30 lines, multiple levels of abstraction | `inspectra_check_file_lengths` (file level), Phase 2 LLM (method level) |
| Large Class | Class > 300 lines, mixed responsibilities | Phase 2 LLM analysis |
| Primitive Obsession | Strings/ints used where value objects belong | Phase 2 LLM analysis |
| Long Parameter List | Function with 4+ parameters | Phase 2 LLM analysis |
| Data Clumps | Same group of variables passed together across functions | Phase 2 LLM analysis |

### Object-Orientation Abusers

| Smell | Signs | Inspectra Detection |
| ------- | ------- | --------------------- |
| Switch Statements | `switch` or `if/else` chains on type | Phase 2 LLM analysis |
| Refused Bequest | Subclass ignores inherited methods | Phase 2 LLM analysis |
| Alternative Classes with Different Interfaces | Classes doing the same thing with different method names | Phase 2 LLM analysis, `inspectra_detect_dry_violations` |
| Temporary Field | Fields populated only in certain conditions | Phase 2 LLM analysis |

### Change Preventers

| Smell | Signs | Inspectra Detection |
| ------- | ------- | --------------------- |
| Divergent Change | One class changed for many different reasons | Phase 2 LLM analysis |
| Shotgun Surgery | One change requires edits in many classes | Phase 2 LLM analysis |
| Parallel Inheritance Hierarchies | Adding a subclass in one hierarchy requires adding one in another | Phase 2 LLM analysis |

### Dispensables

| Smell | Signs | Inspectra Detection |
| ------- | ------- | --------------------- |
| Comments (excessive) | Redundant, outdated, or replacement-for-bad-code comments | Phase 2 LLM analysis |
| Duplicate Code | Identical or near-identical code blocks | `inspectra_detect_dry_violations` |
| Dead Code | Unreachable statements, unused functions | Phase 2 LLM analysis |
| Lazy Class | Class that doesn't do enough to justify its existence | Phase 2 LLM analysis |
| Speculative Generality | Abstract classes or features "for the future" that are never used | Phase 2 LLM analysis |
| Data Class | Class with only fields and getters/setters, no behavior | Phase 2 LLM analysis |

### Couplers

| Smell | Signs | Inspectra Detection |
| ------- | ------- | --------------------- |
| Feature Envy | Method references another class's data more than its own | Phase 2 LLM analysis |
| Inappropriate Intimacy | Classes accessing each other's private data | Phase 2 LLM analysis |
| Message Chains | `a.getB().getC().getD()` (Law of Demeter violation) | Phase 2 LLM analysis |
| Middle Man | Class that only delegates to another class | Phase 2 LLM analysis |

---

## Rule → Inspectra Agent Mapping

Mapping between Clean Code rules and Inspectra MCP tools / finding IDs:

### Tool-Detected (source: `"tool"`, confidence ≥ 0.8, IDs 001–499)

| Clean Code Rule | Inspectra Tool | Finding Prefix | Example IDs |
| ----------------- | ---------------- | ---------------- | ------------- |
| N1, N3, N6 — Naming | `inspectra_check_naming` | CNV- | CNV-001 – CNV-049 |
| G5 — DRY / Duplication | `inspectra_detect_dry_violations` | CNV- | CNV-050 – CNV-099 |
| G12 — Clutter (long files) | `inspectra_check_file_lengths` | CNV- | CNV-100 – CNV-149 |
| C5 — Commented-Out Code (TODOs) | `inspectra_check_todos` | CNV- | CNV-150 – CNV-199 |
| G24 — Standard Conventions (lint) | `inspectra_parse_lint_output` | CNV- | CNV-200 – CNV-249 |

### LLM-Detected (source: `"llm"`, confidence ≤ 0.7, IDs 501+)

| Clean Code Rule | Phase 2 Strategy | Finding Prefix | Example IDs |
| ----------------- | ------------------ | ---------------- | ------------- |
| G25 — Magic Numbers | Scan for unnamed numeric/string constants in conditionals | CNV- | CNV-501 – CNV-519 |
| F1 — Too Many Arguments | Count function parameters > 3 | CNV- | CNV-520 – CNV-539 |
| F3 — Flag Arguments | Detect boolean params splitting behavior | CNV- | CNV-540 – CNV-559 |
| G9, F4 — Dead Code | Find unreachable statements, unused exports | CNV- | CNV-560 – CNV-579 |
| G29 — Negative Conditionals | Detect `isNot*`, `!isNot*` double negation patterns | CNV- | CNV-580 – CNV-599 |
| G28 — Unencapsulated Conditionals | Complex boolean expressions without descriptive names | CNV- | CNV-600 – CNV-619 |
| G11 — Inconsistency | Mixed async patterns, inconsistent error handling | CNV- | CNV-620 – CNV-639 |
| N1 – N7 — Misleading Names | Names that don't match behavior | CNV- | CNV-640 – CNV-659 |
| G30, G34 — Functions Too Long / Wrong Abstraction | Functions > 30 lines or mixing abstraction levels | CNV- | CNV-660 – CNV-679 |
| SOLID Violations | SRP, OCP, LSP, ISP, DIP violations at class level | CNV- | CNV-680 – CNV-699 |

### Cross-Domain (handled by `audit-tech-debt`)

| Clean Code Rule | Inspectra Tool | Finding Prefix |
| ----------------- | ---------------- | ---------------- |
| G9 — Dead Code (complexity) | `inspectra_analyze_complexity` | DEBT- |
| C5 — Aged TODOs | `inspectra_age_todos` | DEBT- |
| G12 — Stale Dependencies | `inspectra_check_dependency_staleness` | DEBT- |

---

## Language-Specific Rule Extensions

Additional rules from [Fascinax/clean-code-skills](https://github.com/Fascinax/clean-code-skills):

### TypeScript (TS1–TS8)

| ID | Rule | Rationale |
| ---- | ------ | ----------- |
| TS1 | Use `unknown` instead of `any` | Preserves type safety while allowing flexibility |
| TS2 | Prefer `type` for unions/intersections, `interface` for `extends`/`implements` | Consistent type declaration patterns |
| TS3 | Use `readonly` properties and `as const` assertions | Enforce immutability at the type level |
| TS4 | Use discriminated unions over type casting | Safer branch logic without runtime `instanceof` |
| TS5 | Avoid enums — use `as const` objects or union types | Enums have quirks; const objects are more predictable |
| TS6 | Use strict TypeScript config | Enable `strict`, `noUncheckedIndexedAccess`, `noImplicitReturns` |
| TS7 | Use `import type` for type-only imports | Avoids bundling dead code and circular dependency issues |
| TS8 | Prefer generic constraints over `any` in utility functions | `<T extends Record<string, unknown>>` over `any` |

### JavaScript (JS1–JS7)

| ID | Rule | Rationale |
| ---- | ------ | ----------- |
| JS1 | Use `const` by default, `let` when rebinding is needed, never `var` | Block scoping prevents accidental hoisting bugs |
| JS2 | Prefer arrow functions for callbacks | Lexical `this` binding and concise syntax |
| JS3 | Use optional chaining (`?.`) and nullish coalescing (`??`) | Eliminates verbose null-check chains |
| JS4 | Use strict equality (`===`) always | Prevents type coercion surprises |
| JS5 | Use template literals over string concatenation | More readable, supports multi-line and expressions |
| JS6 | Use `Promise.all` / `Promise.allSettled` for concurrent async | Prevents sequential waterfall of await statements |
| JS7 | Handle all Promise rejections | Every `.then()` needs a `.catch()` or `try/catch` for `await` |

### Java (J1–J10)

| ID | Rule | Rationale |
| ---- | ------ | ----------- |
| J1 | Avoid long import lists — use wildcards | Keeps file headers clean (but consider IDE auto-import) |
| J2 | Don't inherit constants | Use static imports or dedicated constants class, not interface inheritance |
| J3 | Prefer enums over `static final int` constants | Type-safe, iterable, supports methods |
| J4 | Choose clear names — not surprising behavior | `getXxx()` should be cheap; `fetchXxx()` signals I/O |
| J5 | Use `Optional<T>` — never return null from public APIs | Forces callers to handle absence explicitly |
| J6 | Prefer streams over loops for collection processing | Declarative, composable, parallelizable |
| J7 | Close resources with try-with-resources | Prevents resource leaks (files, connections) |
| J8 | Mark fields `final` — make immutability the default | Reduces mutation surface; communicates intent |
| J9 | Use records for value objects (Java 16+) | Immutable data holders with auto-generated `equals`/`hashCode`/`toString` |
| J10 | Minimize checked exceptions — use unchecked for programming errors | Checked for recoverable conditions only |

### Python (P1–P3)

| ID | Rule | Rationale |
| ---- | ------ | ----------- |
| P1 | Use type hints in all function signatures | Enables static analysis, IDE support, and documentation |
| P2 | Prefer dataclasses or Pydantic models over raw dicts | Type safety, validation, auto `__repr__` |
| P3 | Use context managers (`with`) for all resource handling | Guaranteed cleanup even on exceptions |

### Go (GO1–GO8)

| ID | Rule | Rationale |
| ---- | ------ | ----------- |
| GO1 | Accept interfaces, return structs | Flexible input, concrete output |
| GO2 | Handle every error — no `_` for errors | Silent failures cause debugging nightmares |
| GO3 | Use `context.Context` for cancellation and deadlines | Standard Go concurrency pattern |
| GO4 | Keep interfaces small — 1–2 methods | Promotes composability (io.Reader pattern) |
| GO5 | Use `errors.Is`/`errors.As` for error checking | Works with wrapped errors since Go 1.13 |
| GO6 | Prefer table-driven tests | Clean, exhaustive, easy to extend |
| GO7 | Use `sync.Once` for expensive initialization | Thread-safe lazy init without mutexes |
| GO8 | Use goroutines + channels over shared memory | "Don't communicate by sharing memory; share memory by communicating" |

### Rust (RS1–RS8) / C# (CS1–CS8)

See [Fascinax/clean-code-skills](https://github.com/Fascinax/clean-code-skills) for the full RS1–RS8 (Rust) and CS1–CS8 (C#) catalogs.

---

## Stack-Aware Detection

Adapt detection strategies to the target stack:

| Stack Indicator | Framework | Key Clean Code Areas |
| ----------------- | ----------- | ---------------------- |
| `package.json` + `tsconfig.json` | TypeScript / Node.js | TS1–TS8: `strict` mode, `unknown` vs `any`, `import type`, naming conventions (camelCase functions, PascalCase types) |
| `package.json` (no tsconfig) | JavaScript / Node.js | JS1–JS7: `const`/`let`, strict equality, arrow callbacks, Promise handling |
| `angular.json` | Angular | Angular style guide: feature modules, `OnPush` change detection, `trackBy`, service naming |
| `pom.xml` / `build.gradle` | Java | J1–J10: Google Java Style, records, `Optional<T>`, try-with-resources, stream API |
| `go.mod` | Go | GO1–GO8: error handling, small interfaces, table-driven tests, context propagation |
| `pyproject.toml` / `setup.py` | Python | P1–P3: PEP 8, type hints, dataclasses, context managers |
| `Cargo.toml` | Rust | RS1–RS8: ownership patterns, `Result<T,E>`, pattern matching, `clippy` lints |
| `.csproj` / `*.sln` | C# / .NET | CS1–CS8: nullable reference types, `async`/`await`, LINQ, records |

### Naming Convention Matrix

| Element | TypeScript / JavaScript | Java | Go | Python |
| --------- | ------------------------- | ------ | ---- | -------- |
| Local variables | `camelCase` | `camelCase` | `camelCase` | `snake_case` |
| Constants | `UPPER_SNAKE_CASE` | `UPPER_SNAKE_CASE` | `camelCase` (exported `PascalCase`) | `UPPER_SNAKE_CASE` |
| Functions / Methods | `camelCase` | `camelCase` | `PascalCase` (exported) / `camelCase` | `snake_case` |
| Classes / Types | `PascalCase` | `PascalCase` | `PascalCase` | `PascalCase` |
| Interfaces | `PascalCase` (no `I` prefix in TS) | `PascalCase` (no `I` prefix) | suffix `-er` (e.g., `Reader`) | `PascalCase` |
| Files | `kebab-case.ts` | `PascalCase.java` | `snake_case.go` | `snake_case.py` |
| Packages | `kebab-case` | `com.example.lower` | `lowercase` | `snake_case` |
| Booleans | `is*`, `has*`, `should*` | `is*`, `has*`, `can*` | `is*`, `has*` | `is_*`, `has_*` |

---

## Confidence Calibration

For Phase 2 (LLM) findings, calibrate confidence based on detected pattern:

| Confidence Range | Pattern Type | Examples |
| ------------------ | -------------- | ---------- |
| 0.65 – 0.70 | Clear, unambiguous violation with strong evidence | Magic number `86400000` without constant, function with 8 parameters, `var` usage in modern codebase |
| 0.50 – 0.64 | Likely violation with supporting context | Method > 40 lines with mixed abstraction, inconsistent naming in related files |
| 0.35 – 0.49 | Possible improvement, context-dependent | Method could be split but cohesion is arguable, naming is unconventional but project-consistent |

> **Rule**: LLM-detected findings MUST have `confidence ≤ 0.7` and IDs ≥ 501.
> Tool-detected findings MUST have `confidence ≥ 0.8` and IDs 001–499.

---

## Severity Guide

| Severity | Clean Code Impact | Examples |
| ---------- | ------------------- | ---------- |
| **critical** | Fundamentally broken design affecting correctness | Infinite recursion from name mismatch (G2), security-bypassed safeties (G4) |
| **high** | Major maintainability or reliability risk | Massive DRY violations (G5), God classes (>500 lines), 10+ param functions (F1) |
| **medium** | Moderate readability or consistency issue | Magic numbers (G25), 4–5 param functions, mixed naming conventions (G11), missing error handling |
| **low** | Minor style issue, localized impact | Commented-out code (C5), single TODO, slightly long function (30–50 lines) |
| **info** | Observation or improvement suggestion | Opportunity to use polymorphism over switch, potential for method chaining |

---

## Remediation Priority

| Priority | Timeframe | Criteria |
| ---------- | ----------- | ---------- |
| **P0** | Immediate | Critical/high findings that affect correctness or security — often overlap with `audit-security` |
| **P1** | Sprint | High findings impacting team velocity — God classes, massive duplication, no test coverage for complex code |
| **P2** | Quarter | Medium findings — magic numbers, inconsistent patterns, moderate function lengths |
| **P3** | Backlog | Low/info findings — minor cleanups, style improvements, opportunistic refactoring (Boy Scout Rule) |

---

## Metrics & Thresholds

Reference thresholds used by Inspectra tools and LLM strategies:

| Metric | Good | Acceptable | Needs Attention | Source |
| -------- | ------ | ------------ | ----------------- | -------- |
| File length | < 200 lines | 200–400 lines | > 400 lines | `inspectra_check_file_lengths` |
| Function length | < 20 lines | 20–40 lines | > 40 lines | Phase 2 LLM |
| Function parameters | 0–2 | 3 | 4+ | Phase 2 LLM (F1) |
| Cyclomatic complexity | < 10 | 10–20 | > 20 | `inspectra_analyze_complexity` |
| DRY similarity threshold | < 3 occurrences | 3–5 occurrences | 6+ occurrences | `inspectra_detect_dry_violations` |
| Naming violation density | < 2% of symbols | 2–5% | > 5% | `inspectra_check_naming` |
| TODO density | < 5 per 10k LOC | 5–15 per 10k LOC | > 15 per 10k LOC | `inspectra_check_todos` |

---

## Changelog

| Version | Date | Change |
| --------- | ------ | -------- |
| 1.0 | 2025-07 | Initial reference document — Clean Code catalog, SOLID, code smells, stack-aware rules |
