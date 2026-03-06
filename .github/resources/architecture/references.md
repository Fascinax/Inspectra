# Architecture Audit — Reference Material

> This file is the authoritative reference companion for the `audit-architecture` agent.
> It covers Clean Architecture, Hexagonal Architecture, ADRs, dependency metrics, and architecture smells.
>
> | Pillar | Authority | Coverage |
> | ------- | --------- | -------- |
> | Clean Architecture / Dependency Rule | Robert C. Martin (2017) | 4 rings, layer rules, component principles |
> | Hexagonal / Ports & Adapters | Alistair Cockburn (2005) | Ports, adapters, driving/driven asymmetry |
> | Architecture Decision Records | Michael Nygard (2011), MADR | ADR format, lifecycle, quality signals |
> | Dependency Metrics | Robert C. Martin (2002, 2017) | Ca, Ce, I, D, SDP, SAP, ADP |
> | Architecture Smells | Garcia et al. (2009), Mo et al. (2015) | 9 architecture-level smells with detection heuristics |

---

## Part I — External References

| Standard / Paper | Author / Org | URL | What it governs |
| ---------------- | ------------ | --- | --------------- |
| *Clean Architecture* | Robert C. Martin | — (book, 2017) | 4 rings, Dependency Rule, component principles |
| *Agile S/W Development* | Robert C. Martin | — (book, 2002) | SDP, SAP, ADP, Ca/Ce/I/D metrics |
| *Clean Code* | Robert C. Martin | — (book, 2008) | God class detection, SRP |
| The Clean Architecture (blog) | Robert C. Martin | https://blog.cleancoder.com/uncle-bob/2012/08/13/the-clean-architecture.html | Synthesis of Hexagonal, Onion, BCE |
| Hexagonal Architecture | Alistair Cockburn | https://alistair.cockburn.us/hexagonal-architecture/ | Ports & Adapters, driving/driven |
| "Documenting Architecture Decisions" | Michael Nygard | https://cognitect.com/blog/2011/11/15/documenting-architecture-decisions | Original ADR 5-field format |
| MADR | Oliver Kopp et al. | https://adr.github.io/madr/ | Extended ADR format with options/trade-offs |
| RFC 2119 | Scott Bradner | https://www.rfc-editor.org/rfc/rfc2119 | MUST/SHOULD/MAY normative keywords |
| Anemic Domain Model | Martin Fowler | https://martinfowler.com/bliki/AnemicDomainModel.html | Domain object antipattern |
| Big Ball of Mud | Foote & Yoder | PLoP '97 | Absence-of-architecture pattern |
| *Refactoring* | Martin Fowler | — (book, 1999/2018) | Feature envy, inappropriate intimacy |
| dependency-cruiser | Sander Verweij | https://github.com/sverweij/dependency-cruiser | TypeScript static dependency analysis |
| *Object-Oriented Metrics in Practice* | Lanza & Marinescu | — (book, 2006) | God class thresholds (WMC, LCOM) |
| Architecture Smells Catalog | Garcia et al. | QoSA 2009 | 9 architecture-level smell definitions |
| Cross-Module Cycles | Mo et al. | WICSA 2015 | Cyclic dependency severity classification |

---

## Part II — Clean Architecture: The Four Concentric Rings

**Authority:** *Clean Architecture*, Robert C. Martin, Ch. 22
**Rule ID:** `clean-arch-layer-structure`

| Ring | Name | What belongs here | What is FORBIDDEN here |
| ---- | ---- | ----------------- | ---------------------- |
| **1 (innermost)** | Entities | Domain objects, aggregates, value objects, pure business rules | Any outer-ring reference: `typeorm`, `mongoose`, `express`, `axios`, `@nestjs/*`, `pg`, ORM annotations |
| **2** | Use Cases | Application-specific business rules, use case interactors, port interfaces, plain DTOs | HTTP request/response types, ORM row objects, database implementations, UI framework types |
| **3** | Interface Adapters | Controllers, Presenters, Views, Gateway implementations, SQL queries, ORM adapters | Business rules, domain logic |
| **4 (outermost)** | Frameworks & Drivers | Web frameworks, database engines, UI rendering, DI wiring, glue code | Business logic of any kind |

**The Dependency Rule (verbatim):**
> *"Source code dependencies must point only inward, toward higher-level policies."*

**Precise rules:**
1. A class in Ring N must **never** import any symbol declared in Ring N+1 or beyond.
2. Data crossing a boundary must be converted to the most convenient form for the **inner** circle — never pass an ORM row or HTTP request object inward.
3. Control flow may go outward (use case → presenter), but **source-code dependency** must be inverted using interfaces (DIP).
4. The rule applies **transitively**: A → B → C where C is outer means A indirectly violates the rule.

---

## Part III — Layer Violations: Concrete Examples

**Rule ID:** `clean-arch-layer-violation` | **Severity:** `critical`

### Violation: Entity imports ORM annotation (TypeScript)
```ts
// ❌ Ring 1 (entity) importing Ring 4 (TypeORM)
// src/domain/entities/User.ts
import { Entity, Column, PrimaryGeneratedColumn } from 'typeorm'; // FORBIDDEN

@Entity()
export class User {
  @PrimaryGeneratedColumn() id: number;
  @Column() email: string;
}
```

### Violation: Use case imports Express (TypeScript)
```ts
// ❌ Ring 2 (use case) importing Ring 4 (Express)
// src/application/usecases/CreateOrderUseCase.ts
import { Request, Response } from 'express'; // FORBIDDEN

export class CreateOrderUseCase {
  execute(req: Request, res: Response): void { ... } // transport-coupled use case
}
```

### Violation: Angular HttpClient in application service
```ts
// ❌ Application service directly calls HTTP (Angular example)
import { HttpClient } from '@angular/common/http'; // FORBIDDEN in domain/application

@Injectable({ providedIn: 'root' })
export class CartService {
  constructor(private http: HttpClient) {} // direct framework dependency
  addItem(productId: string): Observable<void> {
    return this.http.post<void>('/api/cart', { productId }); // HTTP in domain
  }
}
```

### Violation: Domain service imports Node.js `fs`
```ts
// ❌ Infrastructure concern in domain
import * as fs from 'fs'; // FORBIDDEN in domain

export class InvoiceService {
  generateInvoice(order: Order): void {
    fs.writeFileSync(`./invoices/${order.id}.txt`, this.buildText(order)); // I/O in domain
  }
}
```

### Violation: Circular dependency between two layers
```ts
// ❌ ADP violation: Ring 2 ↔ Ring 3 cycle
// usecase/CheckoutUseCase.ts (Ring 2) imports Ring 3
import { CartPresenter } from '../../adapters/presenters/CartPresenter';
// adapters/presenters/CartPresenter.ts (Ring 3) imports Ring 2
import { CheckoutUseCase } from '../../application/usecases/CheckoutUseCase';
```

### Correct: Application service depends on PORT (interface), not adapter
```ts
// ✅ CORRECT — application layer depends on interface, not implementation
export interface UserRepository {                  // Port (Ring 2)
  findByEmail(email: string): Promise<User | null>;
  save(user: User): Promise<void>;
}

export class RegisterUserService {
  constructor(private readonly userRepo: UserRepository) {} // depends on port

  async execute(cmd: RegisterUserCommand): Promise<UserId> {
    const existing = await this.userRepo.findByEmail(cmd.email);
    if (existing) throw new UserAlreadyExistsError();
    const user = User.register(cmd.email, cmd.passwordHash);
    await this.userRepo.save(user);
    return user.id;
  }
}
```

---

## Part IV — Hexagonal Architecture: Ports & Adapters

**Authority:** Alistair Cockburn, *Hexagonal Architecture*, 2005
**URL:** https://alistair.cockburn.us/hexagonal-architecture/

**Core rule (verbatim):**
> *"Code pertaining to the inside part should not leak into the outside part."*

### Port vs. Adapter

| Concept | What It Is | Where It Lives | Who Owns It |
| ------- | ---------- | -------------- | ----------- |
| **Port** | Interface / boundary contract | Inside the hexagon (application core) | Application |
| **Adapter** | Concrete implementation of a port | Outside (infrastructure) | Infrastructure |

### Primary (Driving) vs. Secondary (Driven) Ports

| Dimension | Primary Port | Secondary Port |
| --------- | ------------ | -------------- |
| Direction | Outside → In (external actor calls app) | Inside → Out (app calls external system) |
| Location | Left of hexagon | Right of hexagon |
| Examples | `OrderApplicationPort`, `UserCommandPort` | `UserRepository`, `EmailGateway`, `PaymentGateway` |
| Test double | FIT harness / controller test | Mock, stub, in-memory fake |

### Forbidden dependencies in the application core

The hexagon interior (domain + application) **MUST NEVER** import:

| Forbidden Category | TypeScript Examples |
| ------------------ | ------------------- |
| HTTP framework | `express.Request`, `express.Response`, `@nestjs/common` decorators |
| ORM entities/annotations | TypeORM `@Entity`, `@Column`, `Repository<T>` |
| Database drivers | `pg`, `mysql2`, `mongoose`, `typeorm` |
| File system | `fs`, `path` in domain logic |
| Message broker SDKs | `amqplib`, `kafkajs`, `@aws-sdk/client-sns` |
| Email client SDKs | `nodemailer`, `@sendgrid/mail` |
| External HTTP clients | `axios`, `fetch`, `HttpClient` |
| Environment config | `process.env` directly in domain |

### Infrastructure Leaks — detection heuristics

| Leak type | Detection approach | Rule ID |
| --------- | ------------------ | ------- |
| ORM annotation on domain entity | `@Entity`, `@Column` in `domain/` or `entities/` paths | `ARC-007` |
| Mongoose Document in domain model | `extends Document` in domain | `ARC-007` |
| HTTP type in application service | `Request`, `Response`, `HttpContext` in `application/` | `ARC-006` |
| Angular HttpClient in domain service | `HttpClient` import outside `infrastructure/` | `ARC-006` |
| Node.js `fs`/`http` in domain | `import * as fs` in domain files | `ARC-006` |
| NestJS `@Injectable` on domain entity | `@Injectable()` on aggregate/entity class | `ARC-007` |

---

## Part V — Architecture Decision Records (ADRs)

**Authority:** Michael Nygard, "Documenting Architecture Decisions", 2011

### Nygard Format (5 fields)

```markdown
# Title
(Short noun phrase — problem solved + solution)

## Status
proposed | accepted | rejected | deprecated | superseded

## Context
Forces at play: technological, political, social, project-local.

## Decision
What we are doing.

## Consequences
What becomes easier or harder. Both positive and negative.
```

### ADR Status Lifecycle

| Status | Meaning | Mutability |
| ------ | ------- | ---------- |
| `proposed` | Under review | Mutable |
| `accepted` | In force | Effectively immutable |
| `rejected` | Explicitly not adopted | Immutable; kept for institutional memory |
| `deprecated` | No longer recommended | Status-only change allowed |
| `superseded` | Replaced by newer ADR | Must link: `Superseded by [ADR-XXXX]` |

**Lifecycle rules:**
- An accepted ADR MUST NOT be edited to change its substance — create a new ADR instead.
- Bi-directional linking MUST be maintained between superseding/superseded ADRs.

### ADR Location Conventions

| Convention | Tool | Notes |
| ---------- | ---- | ----- |
| `doc/adr/` | adr-tools default | Nat Pryce's `adr init` default |
| `docs/adr/` | log4brains default | |
| `doc/architecture/decisions/` | adr-tools example | |
| `packages/<name>/docs/adr/` | monorepo pattern | log4brains multi-package |

**Numbering:** 4-digit zero-padded sequential (`0001-...`). Never renumbered. Permanent.

### Missing ADR — when is it a finding?

| Situation | Severity | Rule ID |
| --------- | -------- | ------- |
| Non-trivial project has no ADR directory at all | `high` | `ARC-035` |
| ADR directory exists but fewer than 3 ADRs | `medium` | `ARC-036` |
| Major framework choice (Angular/React, PostgreSQL, NestJS) has no ADR | `medium` | `ARC-037` |
| Architecture pattern choice (hexagonal, CQRS, microservices) has no ADR | `medium` | `ARC-037` |

### Quality signals — Good ADR vs. Bad ADR

**Good:**
- Specific rationale and alternatives considered
- One decision, one ADR
- Populated Context section with team/business constraints
- Consequences cover both positive and negative
- Links to related ADRs

**Bad:**
- Status stuck at `proposed` forever
- Empty or vague Context
- Only one option mentioned (no alternatives)
- Covers multiple unrelated decisions
- Substance retroactively edited after acceptance

---

## Part VI — Dependency Metrics

**Authority:** *Clean Architecture*, Ch. 14; *Agile Software Development*, Ch. 20

### Ca, Ce, I, A, D

| Metric | Formula | Range | Meaning |
| ------ | ------- | ----- | ------- |
| **Ca** (Afferent coupling / fan-in) | count of external importers | ≥ 0 | How many modules depend on this one |
| **Ce** (Efferent coupling / fan-out) | count of external imports | ≥ 0 | How many modules this one depends on |
| **I** (Instability) | `Ce / (Ca + Ce)` | [0, 1] | 0 = maximally stable, 1 = maximally unstable |
| **A** (Abstractness) | `Na / Nc` (abstract classes / total classes) | [0, 1] | 0 = fully concrete, 1 = fully abstract |
| **D** (Distance from Main Sequence) | `\|A + I - 1\|` | [0, 1] | 0 = ideal; Zone of Pain (A≈0, I≈0); Zone of Uselessness (A≈1, I≈1) |

### Stable Dependencies Principle (SDP)

**Rule:** Depend in the direction of stability. For every dependency A → B: `I(A) ≥ I(B)`.

| Component type | Expected I | Finding if violated |
| -------------- | --------- | ------------------- |
| Domain / core entities | I ≈ 0 (stable) | Domain I > 0.3 → warning |
| Application services | I ≈ 0.2–0.4 | — |
| Infrastructure adapters | I ≈ 0.8–1.0 (unstable) | Adapter I < 0.5 → suspicious |

**Violation rule ID:** `ARC-021` (SDP violation — stable component depends on unstable one)

### Acyclic Dependencies Principle (ADP)

**Rule:** The component dependency graph MUST be a Directed Acyclic Graph (DAG).

Cycles prevent independent deployment, force lockstep releases, and create the "morning after syndrome."

**Cycle severity by length and scope:**

| Cycle type | Severity | Rule ID |
| ---------- | -------- | ------- |
| 2 modules (direct cycle) | `medium` | `ARC-011` |
| 3–4 modules (short transitive) | `high` | `ARC-012` |
| ≥ 5 modules | `critical` | `ARC-013` |
| Cross-layer cycle (any length) | `critical` | `ARC-014` |
| Cross-package/module boundary | `critical` | `ARC-015` |

### Fan-out thresholds

| Fan-out | Severity | Notes |
| ------- | -------- | ----- |
| ≤ 10 | OK | Normal |
| 11–15 | `low` | Worth reviewing |
| 16–20 | `medium` | Module becoming a hub |
| > 20 | `high` | God Component / Dense Structure; demands decomposition |

### Distance thresholds

| D value | Meaning | Finding |
| ------- | ------- | ------- |
| D ≤ 0.1 | Near Main Sequence | OK |
| 0.1 < D ≤ 0.3 | Slightly misaligned | `info` |
| D > 0.3 | Significant misalignment | `medium` |
| D → 1, A≈0, I≈0 | Zone of Pain (concrete + stable) | `high` if volatile component |
| D → 1, A≈1, I≈1 | Zone of Uselessness (abstract + no dependents) | `medium` |

---

## Part VII — Component Cohesion Principles

**Authority:** *Clean Architecture*, Ch. 13

| Principle | Abbrev | Rule | Violation signal | Severity |
| --------- | ------ | ---- | ---------------- | -------- |
| Reuse/Release Equivalence | REP | Group only what can be released together | Component groups `DateUtils` + `PdfGenerator` + `AuthTokenHelper` with no common theme | `low` |
| Common Closure | CCP | Gather classes that change together | Feature change touches 6+ distinct modules | `medium` |
| Common Reuse | CRP | Don't force unneeded dependencies | Large package where users import only 10% of it | `low` |

---

## Part VIII — Architecture Smells Catalog

**Authority:** Garcia et al. (QoSA 2009), Mo et al. (WICSA 2015), Suryanarayana et al. (2014)

| Smell | Definition | Primary Detection Signal | Severity |
| ----- | ---------- | ------------------------ | -------- |
| **Ambiguous Interface** | Single generic entry point with many callers | High Ca + ≤ 1 public method named `process/handle/execute` | `medium` |
| **Broken Hierarchy** | Parent-child relationship semantically incorrect | LSP violations; class inherits but overrides most of parent | `medium` |
| **Broken Modularization** | Cycles within intended modular boundaries | Sibling directories co-importing each other | `high` |
| **Cyclic Dependency** | Cycles crossing architectural layers | Cross-layer cycle detection | `critical` |
| **Dense Structure** | High connectivity throughout the whole graph | Average fan-out > 10; small graph diameter | `high` |
| **God Component** | One package responsible for too many concerns | High Ca + Ce simultaneously; > 20 unrelated source files | `high` |
| **Improper API** | API too large or too volatile | > 30 exported symbols; High Ca + high git commit rate | `medium` |
| **Scattered Functionality** | One concern implemented across many modules | Domain concept appears in 4+ distinct architectural layers | `medium` |
| **Unstable Dependency** | Stable module depends on unstable one | `I(A) < I(B)` where A→B; `moreUnstable` in dependency-cruiser | `high` |

### God Class / God Module thresholds

| Metric | Threshold | Notes |
| ------ | --------- | ----- |
| Lines of Code (LOC) | > 400–500 | Any class over 500 lines warrants scrutiny |
| Number of methods (NOM) | > 20 | Multiple responsibilities |
| Number of fields (NOF) | > 10 instance fields | Accumulated state |
| Distinct outgoing imports (fan-out) | > 15 | Talks to too many others |
| Distinct responsibilities | > 1 | Definitional SRP violation |

**Naming smells for potential God classes:** `Manager`, `Processor`, `Handler`, `Service`, `Helper`, `Utils`, `Controller` with broad scope.

### Anemic Domain Model

**Authority:** Martin Fowler, 2003 — https://martinfowler.com/bliki/AnemicDomainModel.html

```ts
// ❌ ANEMIC: Entity is a pure data bag
class Order { id: string; items: OrderItem[]; status: string; total: number; }

// All logic in "god service" — violates OOP fundamentals
class OrderService {
  applyDiscount(order: Order, pct: number): void { ... }
  calculateTax(order: Order): number { ... }
}
```

**Detection:**
- Entities with 0 business methods (only getters/setters)
- `*Service` classes with > 10 methods operating on a single entity type

### Screaming Architecture violation

**Authority:** *Clean Architecture*, Ch. 21

**Rule:** Top-level directory structure should reveal the **domain**, not the **framework**.

```
# ❌ Screams the framework:
src/ controllers/ models/ views/ services/ repositories/ middlewares/

# ✅ Screams the domain:
src/ patient-registration/ appointment-scheduling/ billing/ prescription-management/
```

**Detection:** Top-level `src/` folders ALL named `controllers/`, `models/`, `views/`, `services/`, `repositories/`, `middlewares/`, `handlers/` → `medium` finding.

---

## Part IX — Static Detection Approaches

### Method 1: Directory-based layer assignment

Assign each directory to a ring. Parse imports. Flag direction violations.

```yaml
layers:
  - { name: entities,       pattern: "src/domain/entities/**", ring: 1 }
  - { name: usecases,       pattern: "src/application/**",     ring: 2 }
  - { name: adapters,       pattern: "src/adapters/**",        ring: 3 }
  - { name: infrastructure, pattern: "src/infrastructure/**",  ring: 4 }
violations:
  - from_ring: 1   to_ring: [2, 3, 4]
  - from_ring: 2   to_ring: [3, 4]
```

### Method 2: Forbidden import pattern matching

```ts
// Forbidden in Ring 1 (entities):
const FORBIDDEN_IN_ENTITIES = [/typeorm/, /mongoose/, /express/, /fastify/,
  /axios/, /pg/, /mysql/, /@nestjs/, /sequelize/, /react/, /angular/];

// Forbidden in Ring 2 (use cases):
const FORBIDDEN_IN_USE_CASES = [
  ...FORBIDDEN_IN_ENTITIES, /express\.Request/, /express\.Response/, /HttpContext/
];
```

### Method 3: Cycle detection

Tarjan's Strongly Connected Components (SCC) algorithm on the import graph.
All SCCs with size > 1 are cycles.

**dependency-cruiser rule:**
```json
{ "name": "no-circular", "severity": "error", "from": {}, "to": { "circular": true } }
```

### Method 4: Framework decorator scanner

Flag these in domain/entity files:
```ts
const FRAMEWORK_DECORATORS = [
  '@Entity', '@Column', '@ManyToOne',                   // TypeORM / JPA
  '@Component', '@Service', '@Repository', '@Autowired', // Spring
  '@Injectable', '@Controller', '@Get', '@Post',          // NestJS
];
```

### Method 5: Dependency-cruiser SDP rule

```js
{
  name: "no-more-unstable-deps",
  comment: "SDP: a module's I should be >= instability of modules it depends on",
  severity: "warn",
  from: {},
  to: { moreUnstable: true }
}
```

---

## Part X — Inspectra Finding Map

### Phase 1 — Tool-detected findings (`source: "tool"`, `confidence ≥ 0.8`, IDs 001–499)

#### Layer violations (`inspectra_check_layering`)

| ID | Rule | Severity | Description |
| -- | ---- | -------- | ----------- |
| `ARC-001` | `layer-violation-domain-to-infra` | `critical` | Domain/entity file imports infrastructure package |
| `ARC-002` | `layer-violation-usecase-to-infra` | `critical` | Use case imports infrastructure or framework type |
| `ARC-003` | `layer-violation-usecase-to-http` | `high` | Use case imports HTTP request/response type |
| `ARC-004` | `layer-violation-domain-to-usecase` | `high` | Entity imports use case (outward dependency) |
| `ARC-005` | `framework-decorator-in-domain` | `high` | ORM/framework decorator found in domain entity |
| `ARC-006` | `http-type-in-application` | `high` | HTTP client/request type in application service |
| `ARC-007` | `orm-annotation-in-entity` | `high` | ORM annotation (`@Entity`, `@Column`) on domain object |
| `ARC-008` | `layer-bypass` | `high` | Module bypasses intermediate layer (direct UI→DB) |

#### Circular dependencies (`inspectra_detect_circular_deps`)

| ID | Rule | Severity | Description |
| -- | ---- | -------- | ----------- |
| `ARC-011` | `circular-dep-2-modules` | `medium` | Direct 2-module cycle |
| `ARC-012` | `circular-dep-short` | `high` | 3–4 module transitive cycle |
| `ARC-013` | `circular-dep-long` | `critical` | ≥ 5 module cycle |
| `ARC-014` | `circular-dep-cross-layer` | `critical` | Cycle crossing architectural layer boundaries |
| `ARC-015` | `circular-dep-cross-package` | `critical` | Cycle crossing package/module boundaries |

#### Dependency health (`inspectra_analyze_dependencies`)

| ID | Rule | Severity | Description |
| -- | ---- | -------- | ----------- |
| `ARC-021` | `sdp-violation` | `high` | Stable component depends on more unstable component |
| `ARC-022` | `excessive-dependencies` | `medium` | `package.json` has > 50 runtime dependencies |
| `ARC-023` | `dependency-sprawl` | `high` | > 100 runtime dependencies in `package.json` |
| `ARC-024` | `god-component-fanout` | `high` | Module fan-out > 20 (imports > 20 distinct modules) |
| `ARC-025` | `hub-dependency` | `high` | Module has both Ca > 15 AND Ce > 15 (hub) |

#### ADR presence (`inspectra_check_adr_presence`)

| ID | Rule | Severity | Description |
| -- | ---- | -------- | ----------- |
| `ARC-031` | `no-adr-directory` | `high` | Non-trivial project has no ADR directory |
| `ARC-032` | `too-few-adrs` | `medium` | ADR directory exists but fewer than 3 ADRs |
| `ARC-033` | `adr-stuck-proposed` | `low` | ADR has `Status: proposed` for > 30 days |
| `ARC-034` | `missing-adr-framework-choice` | `medium` | Major framework/pattern used with no ADR documenting the decision |

### Phase 2 — LLM-detected findings (`source: "llm"`, `confidence ≤ 0.7`, IDs 501+)

| ID | Rule | Severity | Description |
| -- | ---- | -------- | ----------- |
| `ARC-501` | `god-module` | `high` | Service/module handling ≥ 3 unrelated responsibilities |
| `ARC-502` | `leaky-abstraction` | `medium` | Controller returns entity directly (no DTO boundary) |
| `ARC-503` | `inconsistent-di` | `medium` | `new ServiceName(` in source (not tests) — bypasses DI |
| `ARC-504` | `barrel-bloat` | `low` | `index.ts` re-exports 10+ unrelated symbols |
| `ARC-505` | `anemic-domain-model` | `medium` | Domain entity has only getters/setters; logic in external service |
| `ARC-506` | `screaming-architecture-violation` | `medium` | Top-level dirs named by framework (controllers/, services/) not by domain |
| `ARC-507` | `feature-envy` | `medium` | Method accesses another class > 4× more than its own |
| `ARC-508` | `inappropriate-intimacy` | `medium` | Module imports internal/private path of another module |
| `ARC-509` | `scattered-functionality` | `medium` | Single domain concept implemented across 4+ architectural layers |
| `ARC-510` | `unstable-interface` | `medium` | High-Ca file with high git commit rate (Unstable Interface smell) |
| `ARC-511` | `ccp-violation` | `medium` | Feature change consistently requires touching > 5 unrelated modules |
| `ARC-512` | `missing-port-interface` | `high` | Concrete infrastructure class used directly in application service |
| `ARC-513` | `di-container-bypass` | `high` | Core service directly instantiated outside DI in non-test code |

---

## Part XI — Scoring Model

| Finding severity | Points deducted per finding | Cap |
| ---------------- | --------------------------- | --- |
| `critical` | −20 | No cap |
| `high` | −10 | −50 total |
| `medium` | −5 | −30 total |
| `low` | −2 | −10 total |
| `info` | 0 | — |

**Base score:** 100
**Final score:** max(0, 100 − Σ deductions)

| Score | Grade | Meaning |
| ----- | ----- | ------- |
| 90–100 | A | Healthy architecture, clean boundaries |
| 75–89 | B | Minor violations, manageable debt |
| 60–74 | C | Moderate layer violations or coupling issues |
| 40–59 | D | Significant architectural problems |
| < 40 | F | Fundamental architecture breakdown |
