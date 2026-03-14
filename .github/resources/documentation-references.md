# Documentation Audit — Reference Material

> This file is the authoritative reference companion for the documentation audit workflow.
> It covers all three pillars of documentation quality used by Inspectra:
>
> | Pillar | Authority | Coverage |
> | -------- | ---------- | --------- |
> | **README quality** | Billie Thompson (PurpleBooth), Richard Litt (standard-readme), Matias Singers (awesome-readme) | Mandatory sections, 5-minute test, severity mapping, stack variations |
> | **Architecture Decision Records** | Michael Nygard (Cognitect 2011), Oliver Kopp / Olaf Zimmermann (MADR), Joel Parker Henderson | Original format, MADR 4.0.0, when to write, lifecycle, audit signals |
> | **Documentation architecture** | Daniele Procida (Diátaxis) | Four quadrant model (tutorials, how-to, reference, explanation), anti-patterns, coverage audit |
>
> Prompt workflows and audit documentation point here for full details.
> Exploratory analysis should consult this file before classifying documentation findings.

---

## External References

### Primary Sources

| Source | Author(s) | Year | URL |
| -------- | ---------- | ------ | ----- |
| Documenting Architecture Decisions (original blog post) | Michael Nygard (Cognitect) | 2011 | <https://cognitect.com/blog/2011/11/15/documenting-architecture-decisions> |
| ADR GitHub Organization — ADR Homepage | adr.github.io contributors | 2024 | <https://adr.github.io/> |
| MADR — Markdown Architectural Decision Records | Oliver Kopp, Olaf Zimmermann | 2024 | <https://adr.github.io/madr/> |
| ADR Templates Catalog | adr.github.io contributors | 2024 | <https://adr.github.io/adr-templates/> |
| ADR Tooling Catalog | adr.github.io contributors | 2024 | <https://adr.github.io/adr-tooling/> |
| Architecture Decision Record (ADR) — Comprehensive Reference | Joel Parker Henderson | 2025 | <https://github.com/joelparkerhenderson/architecture-decision-record> |
| When Should I Write an Architecture Decision Record? | Josef Blake (Spotify Engineering) | 2020 | <https://engineering.atspotify.com/2020/04/when-should-i-write-an-architecture-decision-record/> |
| AWS Prescriptive Guidance — ADR Process | Amazon Web Services | 2023 | <https://docs.aws.amazon.com/prescriptive-guidance/latest/architectural-decision-records/adr-process.html> |
| Y-Statements — A Light Template for Architectural Decision Capturing | Olaf Zimmermann | 2020 | <https://medium.com/@docsoc/y-statements-10eb07b5a177> |
| Sustainable Architectural Decisions | Zdun et al. | 2013 | <https://www.infoq.com/articles/sustainable-architectural-design-decisions> |
| ThoughtWorks Technology Radar — Lightweight ADRs | ThoughtWorks | ongoing | <https://www.thoughtworks.com/radar/techniques/lightweight-architecture-decision-records> |

### Books

| Title | Author(s) | Year | ISBN |
| ------- | ---------- | ------ | ----- |
| Software Architecture Metrics | Ciceri, Farley, Ford, et al. | 2022 | 978-1098112233 |
| Building Evolutionary Architectures (2nd ed.) | Ford, Parsons, Kua, Sadalage | 2022 | 978-1492097549 |
| Fundamentals of Software Architecture | Richards & Ford | 2020 | 978-1492043454 |
| Documenting Software Architectures: Views and Beyond | Bass, Clements, Kazman | 2010 | 978-0321552686 |
| Design Practice Reference (LeanPub) | Zimmermann et al. | 2021 | <https://leanpub.com/dpr> |

---

## Part I — Nygard's Original ADR Format (2011)

> **Source**: Michael Nygard, Cognitect Blog, November 15, 2011  
> CC0 — released to the public domain.

### Core Philosophy

Nygard introduced ADRs in the context of agile projects where architectural decisions are distributed over time. The motivation is explicit: future developers should understand the *motivation* behind decisions, not just the decisions themselves. Without records, a new developer has only two choices — blindly accept or blindly reverse — both of which are dangerous.

ADRs are kept **in the project repository** (e.g., `doc/arch/adr-NNN.md`) so they are versioned alongside the code. They are:

- **Short**: one to two pages maximum
- **Numbered sequentially and monotonically** — numbers are never reused
- **Immutable when superseded**: old ADRs are retained but marked as superseded with a reference to the replacement ADR
- **Conversational**: written as if talking to a future developer, using full sentences and active voice

### The 5-Section Nygard Template

```markdown
# ADR NNN: {Short Noun Phrase Title}

## Context

{Describe the forces at play — technological, political, social, project-local.
These forces are probably in tension. The language here is value-neutral; this
section describes facts, not opinions.}

## Decision

{Our response to the forces. Written in full sentences with active voice.
Always begins with "We will …"}

## Status

{One of: proposed | accepted | deprecated | superseded [by ADR-NNN]}

## Consequences

{The resulting context after applying the decision. List ALL consequences —
positive, negative, and neutral. Do not omit the tradeoffs.}
```

> **Note**: The original Nygard template has 5 labeled sections. "Status" appears between "Decision" and "Consequences" in common practice, though the blog post lists Context → Decision → Status → Consequences. Title is a short noun phrase (e.g., "ADR 1: Deployment on Ruby on Rails 3.0.10").

### Field Definitions (Nygard)

| Field | Type | Definition |
| ------- | ------ | ----------- |
| **Title** | Noun phrase | Short, present-tense noun phrase identifying the decision. Pattern: `ADR NNN: <subject>`. |
| **Context** | Descriptive prose | Forces at play that create the need for a decision. Includes technical constraints, team composition, business requirements, political factors. Value-neutral language — facts only. |
| **Decision** | Active-voice statement | The chosen response to the forces. Begins with "We will …". Central piece of the document. |
| **Status** | Enum | Lifecycle state of the decision. One of `proposed`, `accepted`, `deprecated`, `superseded`. |
| **Consequences** | Prose/list | All resulting effects — good, bad, and neutral. Consequences of one ADR often become the **context** for subsequent ADRs. |

---

## Part II — Extended ADR Formats

### 2.1 MADR — Markdown Architectural Decision Records

> **Source**: Oliver Kopp, Olaf Zimmermann — <https://adr.github.io/madr/> (current version: 4.0.0, released 2024-09-17)  
> Originally "Markdown Any Decision Records"; since v4.0.0 renamed back to "Markdown **Architectural** Decision Records".  
> Scientific publication: [Markdown Architectural Decision Records: Format and Tool Support, ZEUS 2018](https://dblp.org/rec/conf/zeus/KoppAZ18.html)

MADR emphasizes **considered options with pros/cons** as crucial to understanding the rationale. It adds decision drivers, option trade-off analysis, and confirmation criteria beyond Nygard's minimalist format.

#### MADR Full Template (v4.0.0)

```markdown
---
# Optional front matter for Jekyll-based rendering
status: "{proposed | rejected | accepted | deprecated | … | superseded by ADR-0123}"
date: {YYYY-MM-DD when the decision was last updated}
decision-makers: {list everyone involved in the decision}
consulted: {list everyone whose opinions are sought; two-way communication}
informed: {list everyone kept up-to-date on progress; one-way communication}
---

# {short title, representative of solved problem and found solution}

## Context and Problem Statement

{Describe the context and problem statement, e.g., in free form using two to
three sentences or in the form of an illustrative story. You may want to
articulate the problem in form of a question and add links to collaboration
boards or issue management systems.}

<!-- Optional -->
## Decision Drivers

* {decision driver 1, e.g., a force, facing concern, …}
* {decision driver 2, e.g., a force, facing concern, …}

## Considered Options

* {title of option 1}
* {title of option 2}
* {title of option 3}

## Decision Outcome

Chosen option: "{title of option 1}", because {justification — only option
meeting k.o. criterion | resolves force | comes out best (see below)}.

<!-- Optional -->
### Consequences

* Good, because {positive consequence, e.g., improvement of one or more
  desired qualities, …}
* Bad, because {negative consequence, e.g., compromising one or more
  desired qualities, …}

<!-- Optional -->
### Confirmation

{Describe how implementation/compliance with the ADR can be confirmed. E.g.,
a design/code review or a test with a library such as ArchUnit.}

<!-- Optional -->
## Pros and Cons of the Options

### {title of option 1}

* Good, because {argument a}
* Good, because {argument b}
* Neutral, because {argument c}
* Bad, because {argument d}

### {title of option 2}

* Good, because {argument a}
* Bad, because {argument b}

<!-- Optional -->
## More Information

{Additional evidence, team agreement, when/how to revisit, links to other
decisions and resources.}
```

#### MADR Fields Summary

| Field | Required | Notes |
| ------- | --------- | ------- |
| Title | Yes | Short noun phrase representing solved problem + solution |
| Context and Problem Statement | Yes | 2–3 sentences or a question; may link to issue trackers |
| Decision Drivers | No | Bulleted forces/concerns; makes implicit criteria explicit |
| Considered Options | Yes | At minimum 2 alternatives (even "do nothing" counts) |
| Decision Outcome | Yes | States chosen option with explicit justification |
| Consequences | No | Good/bad/neutral bullets; replaces separate Positive/Negative from v3.x |
| Confirmation | No | How to verify compliance with the decision (ArchUnit, code review, etc.) |
| Pros and Cons of the Options | No | Detailed trade-off matrix per option |
| More Information | No | Links, review schedule, related ADRs |
| Front matter (status, date, decision-makers, consulted, informed) | No | RACI-aligned metadata for governance |

#### MADR File Naming Convention

- Pattern: `NNNN-title-with-dashes.md` (e.g., `0012-use-postgresql-as-primary-database.md`)
- Directory: `docs/decisions/` (standard MADR convention)
- Max 9,999 ADRs per directory; use subdirectories (`decisions/backend/`, `decisions/ui/`) for large projects
- Install via: `npm install madr && mkdir -p docs/decisions && cp node_modules/madr/template/* docs/decisions/`

#### MADR Minimal Template

```markdown
# {short title of solved problem and solution}

## Context and Problem Statement

{Describe the context and problem statement.}

## Considered Options

* {title of option 1}
* {title of option 2}

## Decision Outcome

Chosen option: "{title of option 1}", because {justification}.
```

---

### 2.2 Y-Statements

> **Source**: Olaf Zimmermann — <https://medium.com/@docsoc/y-statements-10eb07b5a177>  
> Used in the *Sustainable Architectural Decisions* framework by Zdun et al.

Y-Statements are ultra-compact, single-sentence ADRs suitable for quick decision capture in meeting notes, commit messages, or inline code annotations.

#### Short Form

```
In the context of <use case/user story>, facing <concern>, we decided for
<option> to achieve <quality>, accepting <downside>.
```

#### Long Form (with "because")

```
In the context of <use case/user story>, facing <concern>, we decided for
<option> and neglected <other options>, to achieve <system qualities/desired
consequences>, accepting <downside/undesired consequences>, because
<additional rationale>.
```

#### Example

```
In the context of the mobile API, facing high read traffic and sub-100ms latency
requirements, we decided for Redis as a caching layer and neglected Memcached and
in-process caching, to achieve consistent low latency at scale, accepting the
additional infrastructure complexity and cache invalidation burden, because our
load tests showed a 10× reduction in p99 latency.
```

---

### 2.3 RFC Format (Request for Comments)

> **Source**: Spotify Engineering, Josef Blake — <https://engineering.atspotify.com/2020/04/when-should-i-write-an-architecture-decision-record/>

RFCs and ADRs are complementary, not competing. At Spotify:

- **RFC** = the collaborative process for reaching a decision (open proposal, comments, iteration)
- **ADR** = the stable record of the concluded decision

| Dimension | RFC | ADR |
| ----------- | ----- | ----- |
| Purpose | Explore and converge on a decision through discussion | Capture the concluded decision for future reference |
| State | Mutable — edited during the review process | Immutable once accepted (create new ADR to supersede) |
| Audience | Active participants in the decision | Future engineers onboarding to the codebase |
| Format | Free-form or structured proposal | Structured template (Nygard, MADR, Y-Statement) |
| Lifecycle | Proposal → Discussion → Conclusion | Proposed → Accepted → Deprecated/Superseded |
| Trigger | "We need to make a big decision" | "A significant decision has been concluded" |

**Spotify's Decision Flow:**

```markdown
Problem identified
    └── Is there a blessed solution?
            ├── YES → Is it documented? → NO → Write ADR (backfill)
            └── NO → Is it a big change?
                        ├── YES → Write RFC → RFC concludes → Write ADR
                        └── NO  → Write ADR directly
```

---

### 2.4 Tyree-Akerman Format (CapitalOne / IEEE)

A more heavyweight template favored in enterprise contexts. Key additions over Nygard:

| Extra Field | Definition |
| ------------- | ----------- |
| Problem | Succinct problem statement |
| Assumptions | Conditions assumed to be true for the decision to hold |
| Constraints | Immovable boundaries (legal, technical, organizational) |
| Positions | Options considered and their brief evaluations |
| Argument | Justification for the chosen option |
| Implications | What must be done as a result of this decision |
| Related Decisions | Links to other ADRs affected by or affecting this one |
| Related Requirements | Requirements driving this decision |
| Related Artifacts | System elements affected |
| Notes | Team notes, open issues |

---

## Part III — When to Write an ADR

> **Source**: Spotify Engineering (Josef Blake, 2020) + Joel Parker Henderson (GitHub, 2025) + Nygard (2011)

### Decision Weight Threshold

An ADR is warranted when a decision has a **measurable effect** on:

| Dimension | Write ADR if… |
| ----------- | -------------- |
| **Structure** | The decision affects module boundaries, layer organization, or service decomposition |
| **Non-functional characteristics** | Performance, security, scalability, reliability, maintainability targets are affected |
| **Dependencies** | A new external library, framework, or service is introduced or removed |
| **Interfaces** | Public APIs, contracts, or protocols are defined or changed |
| **Construction techniques** | A significant shift in how code is written (e.g., adopting a new paradigm, testing strategy) |
| **Cross-team scope** | The decision affects more than one team or service |
| **Reversibility** | The decision is **hard to reverse** — high switching cost, migration effort, or risk |
| **Implicit standards** | An undocumented convention has emerged and should be codified |

### Reversibility vs. Irreversibility

| Decision Type | Reversibility | ADR Priority |
| -------------- | -------------- | ------------- |
| Technology stack choice (language, runtime) | Very low — high migration cost | **Critical** |
| Database engine selection | Low — data migration required | **Critical** |
| Authentication mechanism (OAuth, SAML, JWT) | Low — all consumers must change | **Critical** |
| API versioning strategy | Low — breaking changes affect clients | **Critical** |
| Monorepo vs. multi-repo | Medium — tooling restructuring required | **High** |
| Framework adoption (React, Angular, Spring) | Low-medium | **High** |
| Logging/observability stack | Medium | **High** |
| CI/CD pipeline choice | Medium | **High** |
| Testing library choice (Jest vs. Vitest) | High — easily migrated | **Medium** |
| Code style / linting rules | Very high — tooling enforces it | **Low** |

### Decisions That MUST Have an ADR (High-Value Signals for Audit)

The following decision categories, if present in a codebase with no corresponding ADR, represent a **strong audit signal**:

| Category | Examples of Undocumented Signals |
| --------- | --------------------------------- |
| **Language / Runtime** | `package.json`, `pom.xml`, `go.mod` present — no ADR on language choice |
| **Database** | `docker-compose.yml` with DB image, or ORM config — no ADR on DB selection |
| **Authentication** | JWT libs, OAuth2 clients, Keycloak config — no ADR on auth mechanism |
| **API style** | REST controllers, GraphQL schema, gRPC protos — no ADR on API design contract |
| **API versioning** | `/v1/`, `/v2/` URL patterns or `Accept-Version` headers — no ADR on strategy |
| **Monorepo structure** | `nx.json`, `lerna.json`, `turborepo` — no ADR on repo organization |
| **Frontend framework** | `angular.json`, `vite.config.ts`, `next.config.js` — no ADR on UI framework |
| **State management** | Redux, NgRx, Zustand, Signals — no ADR on state strategy |
| **Test strategy** | Playwright config, Vitest config, JUnit XML — no ADR on test pyramid |
| **Container / orchestration** | `Dockerfile`, `k8s/` directory — no ADR on deployment model |
| **Message broker** | Kafka, RabbitMQ, Azure Service Bus config — no ADR on async messaging |
| **Caching strategy** | Redis config, `@Cacheable` annotations — no ADR on caching layer |
| **Error handling approach** | Global exception handlers, Problem+JSON — no ADR on error contract |
| **Security model** | RBAC config, CSP headers, secret management — no ADR on security approach |

### Spotify's "Almost Always" Rule

> *"When should I write an Architecture Decision Record? Almost always!"*  
> — Josef Blake, Spotify Engineering, 2020

Even small decisions that go unrecorded compound over time into future migrations. ADRs are designed to be **lightweight** — the cost of writing one is far lower than the cost of reconstructing the rationale months later.

---

## Part IV — ADR Lifecycle States

> **Source**: Nygard (2011), MADR v4.0.0, Joel Parker Henderson (2025)

### Standard States

| State | Definition | Transition Rules |
| ------- | ----------- | ----------------- |
| **proposed** | The ADR has been written but not yet reviewed or agreed upon by stakeholders. | → `accepted` (after team consensus) / → `rejected` (if declined) |
| **accepted** | The decision is agreed upon and in effect. The team is implementing or has implemented it. | → `deprecated` (decision still valid but no longer recommended) / → `superseded by ADR-NNN` (replaced by a new decision) |
| **rejected** | The proposal was considered and dismissed. Retained for historical context. | Terminal state (no transition out; a new ADR must be created for the accepted alternative) |
| **deprecated** | The decision was once valid but is no longer recommended (e.g., the technology was deprecated upstream). Does not mean it was wrong — it served its purpose. | → `superseded by ADR-NNN` if a replacement exists |
| **superseded** | A new ADR has explicitly replaced this one. The old ADR is retained with a pointer to its replacement. | Terminal state — old ADR is immutable, link to new ADR is added |

### Transition Diagram

```
                        ┌──────────────────────┐
                        │                      │
   [drafted]  ──────►  proposed  ──────────►  accepted
                          │                    │      │
                          ▼                    ▼      ▼
                       rejected           deprecated  superseded
                                               │       (by ADR-NNN)
                                               ▼
                                           superseded
                                           (by ADR-NNN)
```

### Immutability Rule

From Nygard (2011):
> *"If a decision is reversed, we will keep the old one around, but mark it as superseded."*

**Correct behavior**: Create a new ADR. Add `## Status: Superseded by ADR-042` to the old ADR. Add a link to the old ADR in the new one's context.

**Anti-pattern**: Editing the content of an accepted ADR to reflect the new decision (destroys historical record).

> **Joel Parker Henderson's pragmatic exception**: In practice, many teams adopt a "living document" approach — inserting new info into the existing ADR with a datestamp. This trades strict immutability for lower overhead and is acceptable when the team chooses it explicitly.

### Joel Parker Henderson's Extended Lifecycle (Teamwork Model)

```
Initiating → Researching → Evaluating → Implementing → Maintaining → Sunsetting
```

Each phase requires:
1. Completed research + evaluation
2. Published proposal with stakeholder request-for-comments + timebox (e.g., 1 week)
3. All stakeholder comments addressed
4. Vote by designated stakeholders

---

## Part V — Audit Signals for ADR Quality and Presence

### 5.1 Ratio Thresholds — ADR Count vs. Project Age/Size

These are heuristic thresholds for the `audit-documentation` agent to flag projects with suspiciously few ADRs:

| Project Age | Min Expected ADR Count | Rationale |
| ------------ | ----------------------- | ---------- |
| < 1 month | 0–2 | Project too young; tech stack ADRs should exist |
| 1–6 months | 3–8 | Active scaffolding phase; major decisions should be captured |
| 6–18 months | 8–20 | Multiple architectural cycles; ADR backlog should be non-trivial |
| > 18 months | 15+ | Mature system; significant ADR log expected |

Additional signals:
- **0 ADRs in a project with `docs/` or `doc/` directory** → strong signal (a `docs/` dir suggests documentation intent)
- **0 ADRs in a project with multiple major dependencies** → strong signal
- **0 ADRs in a project with > 5 contributors** → strong signal (team decisions need documentation)
- **Last ADR > 12 months ago in an active repo** → potential staleness signal
- **Only 1 ADR total** → likely incomplete; check if it is a "template test" ADR

### 5.2 Staleness Detection

An ADR is **stale** when the decision it documents has effectively changed but the ADR has not been updated. Detectable signals:

| Condition | Detection Strategy |
| ----------- | ------------------- |
| ADR says "we use X" but codebase uses Y | Compare ADR decision text with `package.json`, ORM configs, Docker images, import patterns |
| ADR status is `proposed` but the implementation is complete | Git log of related files is older than ADR date; status never changed |
| ADR status is `accepted` but the technology was deprecated | Match ADR subject against known EOL/deprecated tech list |
| ADR says "we rejected X" but X is now present | Scan imports/dependencies for the rejected technology |
| Superseded ADR has no `superseded by` link | `grep -r "superseded"` with no ADR reference |
| Last ADR predates a major framework version bump by > 1 major version | Compare ADR date with `package.json` dependency versions |

### 5.3 Quality Anti-Patterns

| Anti-Pattern | Description | Severity |
| ------------- | ----------- | --------- |
| **Empty context** | Context section is a template placeholder or blank. The forces driving the decision are unknown. | High |
| **No consequences listed** | Only the positive outcome is described; trade-offs and risks are omitted. | High |
| **No alternatives considered** | Decision section has no mention of other options. Implies the record was written after-the-fact to justify a choice rather than document reasoning. | High |
| **Passive voice decision** | Decision section uses "was decided" or "it was agreed" instead of active "We will…". Obscures who made the decision. | Medium |
| **One-liner ADR** | Entire ADR is a single sentence with no context or consequences. | High |
| **Title is too vague** | Title is generic (e.g., "Database Decision" with no indication of what was decided). | Medium |
| **No status field** | Lifecycle state is absent — impossible to know if decision is still in effect. | High |
| **Numeric ID gap** | ADR sequence has unexplained gaps (e.g., ADR-001, ADR-002, ADR-007) — missing records. | Medium |
| **Future-tense context** | Context describes planned work rather than current forces. ADR was written before the problem was real. | Low |
| **Consequences = consequences of NOT deciding** | Consequences section describes what happens if no decision is made, not what happens as a result of the decision made. | Medium |
| **No date / timestamp** | Unable to assess whether the ADR is stale or current. | Medium |
| **Resolved to "investigate later"** | Decision is deferred with no follow-up ADR, creating a documentation debt. | Medium |

### 5.4 Decisions Without ADRs — Detection Heuristics

The following file/pattern signatures in a codebase, with no corresponding ADR text that matches, are strong audit signals:

```
package.json / package-lock.json      → framework/runtime choices undocumented
pom.xml / build.gradle                → Java dependency choices undocumented
go.mod                                → Go module choices undocumented
Dockerfile / docker-compose.yml       → container/deployment strategy undocumented
*.tf (Terraform) / *.bicep            → IaC/cloud provider choice undocumented
nginx.conf / traefik.yml             → reverse proxy / routing undocumented
src/**/auth/ or keycloak*.json       → auth mechanism undocumented
src/**/**/v1/ or **/v2/              → API versioning strategy undocumented
angular.json / next.config.js         → frontend framework undocumented
nx.json / lerna.json / turbo.json     → monorepo strategy undocumented
redis.conf / **/cache/**              → caching strategy undocumented
kafka*.yml / rabbitmq*.yml            → messaging strategy undocumented
src/**/__tests__/ or spec/            → test strategy undocumented
.github/workflows/*.yml              → CI/CD strategy undocumented (common omission)
```

### 5.5 ADR Coverage Score

For `audit-documentation`, the following scoring heuristic applies:

```
adr_count       = number of ADRs in docs/adr/ or doc/arch/ or docs/decisions/
expected_adrs   = f(project_age_months, contributor_count, major_dep_count)
coverage_ratio  = adr_count / expected_adrs
quality_penalty = count of anti-patterns detected / adr_count

adr_score = min(100, coverage_ratio × 100) × (1 - quality_penalty × 0.1)
```

| Score Range | Interpretation |
| ------------ | -------------- |
| 90–100 | ADR log is comprehensive, current, and high quality |
| 70–89 | Adequate coverage but gaps or quality issues present |
| 50–69 | Significant decisions undocumented; moderate quality issues |
| 30–49 | Most architectural decisions lack documentation |
| 0–29 | ADR culture absent; critical decisions undocumented |

---

## Part VI — Tooling

### 6.1 adr-tools (Nygard Template)

> **Source**: Nat Pryce — <https://github.com/npryce/adr-tools>

Bash scripts for managing ADRs in the Nygard format.

```bash
# Initialize ADR directory
adr init doc/arch

# Create a new ADR
adr new "Use PostgreSQL as primary database"
# → creates doc/arch/0001-use-postgresql-as-primary-database.md

# Supersede an ADR
adr new -s 9 "Use Redis for session storage"
# → creates new ADR and marks ADR-009 as superseded

# Link ADRs
adr link 4 Amends 3 "Is amended by"

# List ADRs
adr list
```

Available ports: C#, Go, Java (`adr-j`), Node.js (ESM), PowerShell, Python, Rust.

### 6.2 Log4brains

> <https://github.com/thomvaill/log4brains>

Supports MADR 2.1.2. Dual functionality:
- **CLI**: creates and manages ADRs in Markdown
- **Web UI**: renders ADRs as a searchable static website (serves as a knowledge base portal)

```bash
npm install -g log4brains
log4brains init
log4brains adr new
log4brains preview   # renders the knowledge base locally
log4brains build     # generates a static site
```

### 6.3 ADR Manager (MADR)

> VS Code Extension: `StevenChen.vscode-adr-manager`  
> Web UI: connects to GitHub to edit ADRs in a form-based interface  
> Supports MADR 2.1.2

### 6.4 pyadr (MADR Lifecycle CLI)

> <https://pypi.org/project/pyadr/> — Python CLI  
> Full lifecycle support: `propose`, `accept`, `reject`, `deprecate`, `supersede`

```bash
pip install pyadr
pyadr propose "Use GraphQL for client-facing APIs"
pyadr accept docs/decisions/0007-use-graphql-for-client-facing-apis.md
pyadr supersede docs/decisions/0007-*.md --by docs/decisions/0015-rest-api.md
```

### 6.5 Backstage ADR Plugin

> <https://github.com/backstage/community-plugins/tree/main/workspaces/adr>

Explores and searches ADRs within a Backstage developer portal. Supports MADR 2.1.2 and 3.x. Enables cross-repo ADR search at scale.

### 6.6 ADG (Architectural Decision Guidance)

> <https://github.com/adr/ad-guidance-tool> — Go CLI  
> Template options: Nygard, MADR (basic), QOC  
> Supports step-by-step guidance for decision modeling and reuse

### 6.7 Tooling Comparison

| Tool | Template | Interface | Notable Feature |
| ------ | --------- | --------- | ---------------- |
| `adr-tools` | Nygard | CLI (bash) | Supersede, link, list commands |
| `Log4brains` | MADR 2.1.2 | CLI + Web UI | Rendered knowledge base |
| `ADR Manager` | MADR 2.1.2 | VS Code / Web | Form-based editing, GitHub integration |
| `pyadr` | MADR 2.1.2 | CLI (Python) | Full lifecycle state management |
| `Backstage ADR plugin` | MADR 2.1.2 / 3.x | Portal UI | Multi-repo search at scale |
| `ADG` | Nygard / MADR / QOC | CLI (Go) | Decision guidance and reuse |
| `dotnet-adr` | Any | CLI (.NET) | Cross-platform, .NET toolchain |
| `Decision Guardian` | Any | GitHub PR | Surfaces ADRs during code review |

---

## Part VII — ADR Presence Indicators for File System Detection

The `audit-documentation` agent should scan for ADRs in the following standard locations, in priority order:

| Priority | Path Pattern | Convention Used by |
| --------- | ------------ | ------------------ |
| 1 | `docs/decisions/` | MADR (canonical) |
| 2 | `docs/adr/` | Common community convention |
| 3 | `doc/arch/` | Nygard original |
| 4 | `doc/adr/` | Variant of Nygard |
| 5 | `architecture/decisions/` | Enterprise projects |
| 6 | `adr/` | Minimalist projects |
| 7 | `.decisions/` | Rare but valid |
| 8 | Any `*.md` matching `/adr-\d{3,4}-/` or `/\d{4}-.*\.md/` | MADR naming pattern |

ADR file detection patterns:
- `adr-NNN-*.md` (Nygard/adr-tools pattern)
- `NNNN-title-with-dashes.md` (MADR pattern)
- Any `*.md` file whose first H1 is `# ADR NNN:` or `# NNNN `
- Any `*.md` file containing the literal section headers `## Status` and `## Context`

---

## Part VIII — Source Attribution

| Concept | Attribution |
| --------- | ------------ |
| Original ADR concept and 5-section Nygard format | **Michael Nygard**, Cognitect (Nu Holdings), November 15, 2011. Blog post: *"Documenting Architecture Decisions"*. Released CC0. |
| ADR GitHub organization and MADR format | **Oliver Kopp** (primary) and **Olaf Zimmermann**, adr.github.io, 2017–2024. MADR 4.0.0 released 2024-09-17. |
| Y-Statement format | **Olaf Zimmermann**, "Sustainable Architectural Decisions" (with U. Zdun et al.), InfoQ 2013; blog post 2020. |
| Comprehensive ADR reference and community templates | **Joel Parker Henderson**, GitHub (joelparkerhenderson/architecture-decision-record), 2018–2025. 15k+ stars. |
| RFC + ADR workflow and "almost always" heuristic | **Josef Blake**, Spotify Engineering, April 14, 2020. |
| AWS Prescriptive Guidance on ADR process | **Amazon Web Services** Prescriptive Guidance team, 2023. |
| ThoughtWorks Radar entry — Lightweight ADRs | **ThoughtWorks** Technology Insights team, 2016–ongoing. |
| ArchUnit (architecture fitness functions for decisions) | **TNG Technology Consulting**, 2017–ongoing. |

---

## Part IX — Diátaxis Documentation Framework

> **Source**: Daniele Procida, *Diátaxis — A systematic approach to technical documentation authoring*  
> **URL**: <https://diataxis.fr/>  
> **Copyright**: © Daniele Procida  
> **Etymology**: From Ancient Greek δῐᾰ́τᾰξῐς: *dia* ("across") + *taxis* ("arrangement")  
> **Tagline**: "The Grand Unified Theory of Documentation" — David Laing

Diátaxis identifies **four distinct user needs** and four corresponding forms of documentation. It places them in a systematic relationship and proposes that documentation architecture should be organised around those needs. It solves problems related to documentation **content** (what to write), **style** (how to write it) and **architecture** (how to organise it).

---

### 9.1 The Two Axes (Theoretical Foundation)

Diátaxis is grounded in two orthogonal dimensions of craft/skill:

#### Axis 1 — Action vs. Cognition

| Pole | Meaning | Documentation Implication |
| ------ | --------- | -------------------------- |
| **Action** | Practical knowledge — *knowing how*, what we **do** | Guides, steps, directions |
| **Cognition** | Theoretical knowledge — *knowing that*, what we **think** | Description, explanation, facts |

#### Axis 2 — Acquisition vs. Application

| Pole | Meaning | Documentation Implication |
| ------ | --------- | -------------------------- |
| **Acquisition** (study) | The practitioner is *learning* the craft, acquiring skills | Learning-oriented: tutorials, explanation |
| **Application** (work) | The practitioner is *using* the craft, applying skills | Work-oriented: how-to guides, reference |

#### The Compass (Decision Tool)

The Diátaxis compass reduces classification to two binary questions:

| Action or cognition? | Acquisition or application? | → Documentation type |
| ---------------------- | ----------------------------- | --------------------- |
| Action | Acquisition (study) | **Tutorial** |
| Action | Application (work) | **How-to guide** |
| Cognition | Application (work) | **Reference** |
| Cognition | Acquisition (study) | **Explanation** |

> *"To use the compass, just two questions need to be asked: action or cognition? acquisition or application? And it yields the answer."* — Procida

---

### 9.2 The Four Quadrants

#### Overview Table

| | **Action** (practical steps) | **Cognition** (theoretical knowledge) |
| --- | --- | --- |
| **Acquisition** (study) | **Tutorial** — learning-oriented | **Explanation** — understanding-oriented |
| **Application** (work) | **How-to guide** — goal-oriented | **Reference** — information-oriented |

Full comparison from Diátaxis canonical map:

| | Tutorials | How-to guides | Reference | Explanation |
| --- | --- | --- | --- | --- |
| **What they do** | Introduce, educate, lead | Guide | State, describe, inform | Explain, clarify, discuss |
| **Answers the question** | "Can you teach me to…?" | "How do I…?" | "What is…?" | "Why…?" |
| **Oriented to** | Learning | Goals | Information | Understanding |
| **Purpose** | Provide a learning experience | Help achieve a particular goal | Describe the machinery | Illuminate a topic |
| **Form** | A lesson | A series of steps | Dry description | Discursive explanation |
| **Culinary analogy** | Teaching a child how to cook | A recipe in a cookery book | Nutritional info on a food packet | Article on culinary social history |
| **User state** | At study | At work | At work | At study |
| **Cognitive mode** | Doing (concrete, hands-on) | Doing (goal-driven, real-world) | Consulting (looking up facts) | Reflecting (understanding context) |

---

### 9.3 Tutorial — Detailed Profile

> *"A tutorial is a practical activity, in which the student learns by doing something meaningful, towards some achievable goal."*  
> *"A tutorial serves the user's acquisition of skills and knowledge — their study."*

**Definition**: A lesson. Learning-oriented. The teacher-student relationship is a near-total contract where the teacher bears all responsibility for the learner's success.

**Key obligation**: *"The only responsibility of the pupil in this contract is to be attentive and to follow the teacher's directions as closely as they can."*

#### What a Tutorial MUST include

| Principle | Guidance |
| ---------- | --------- |
| Show destination upfront | *"In this tutorial we will create and deploy…"* (NOT *"you will learn…"* — presumptuous) |
| Deliver visible results early and often | Every step must produce a comprehensible, meaningful result |
| Maintain a narrative of expectations | *"You will notice that…"; "After a few moments, the server responds with…"* |
| Point out what the learner should notice | Actively close loops of learning; prompt observation |
| Target the feeling of doing | Build towards the practitioner's joined-up feeling of confident rhythm |
| Encourage and permit repetition | Design steps to be repeatable; repetition reinforces learning |
| Focus on the concrete and particular | Concrete specifics now → general abstract patterns emerge naturally |
| Aspire to perfect reliability | Every user, every time — must produce the expected result |

#### What a Tutorial MUST NOT include

| Anti-pattern | Reason |
| ------------- | -------- |
| Explanation | *"Explanation distracts their attention from [doing], and blocks their learning."* |
| Abstraction / generalisation | Students learn from concrete experience, not abstractions |
| Choices or alternatives | Maintain a single focused path; alternatives are cognitive overhead |
| Raw information delivery | Information without context is anti-pedagogical |

> *"Ruthlessly minimise explanation."* — Procida  
> *"Explanation is one of the hardest temptations for a teacher to resist."* — Procida

#### Good tutorial language patterns

```
"We …"                       → first-person plural affirms the teacher/student bond
"In this tutorial, we will …"  → state what will be accomplished (not "you will learn")
"First, do x. Now, do y."    → unambiguous, sequential directives
"The output should look something like …" → set concrete expectations
"Notice that… Remember that…"  → guide observation
"You have built a…"          → celebrate the concrete achievement
```

---

### 9.4 How-to Guide — Detailed Profile

> *"How-to guides are directions that guide the reader through a problem or towards a result. How-to guides are goal-oriented."*  
> *"A how-to guide helps the user get something done, correctly and safely; it guides the user's action."*

**Definition**: A recipe. Addresses a specific user need or problem. The user is already competent; the guide serves their **work**, not their education.

#### What a How-to Guide MUST include

| Principle | Guidance |
| ---------- | --------- |
| Be problem/goal-defined | Defined by user need, not by tool or system capability |
| Address real-world complexity | Must be adaptable; fork and branch for real-world variations |
| Provide a logical sequence | Steps ordered by how humans think and act, not arbitrary |
| Seek flow | Guide anticipates the user — *"the tool you were about to reach for, ready in your hand"* |
| Use conditional imperatives | *"If you want x, do y. To achieve w, do z."* |
| Describe an executable solution | *"If you're facing this situation, then you can work your way through it by taking these steps"* |
| Omit the unnecessary | Practical usability over completeness; start and end in a meaningful place |
| Pay attention to naming | Titles must say exactly what the guide shows |

#### Naming rules

| Quality | Example |
| --------- | --------- |
| Good | *How to integrate application performance monitoring* |
| Bad (ambiguous intent) | *Integrating application performance monitoring* |
| Very bad (topic-only) | *Application performance monitoring* |

#### What a How-to Guide MUST NOT include

| Anti-pattern | Reason |
| ------------- | -------- |
| Teaching / explanation | User is already competent; teaching patronises and wastes their time |
| Reference data dumps | Pollutes the guide; link to reference instead |
| Step-by-step that ignores real-world branching | Real problems are not always linear |
| Tool-centric framing | *"Press Deploy"* is not guidance; address the human goal, not the button |

> *"How-to guides are about goals, projects and problems, not about tools."* — Procida  
> *"A rich list of how-to guides is an encouraging suggestion of a product's capabilities."* — Procida

#### Good how-to guide language patterns

```
"This guide shows you how to …"  → explicit problem/task declaration
"If you want x, do y."          → conditional imperative
"Refer to the x reference guide for a full list of options." → defer to reference
```

---

### 9.5 Reference — Detailed Profile

> *"Reference guides are technical descriptions of the machinery and how to operate it. Reference material is information-oriented."*  
> *"One hardly reads reference material; one consults it."*

**Definition**: Like a map — or the nutritional facts panel on a food packet. Describes the machinery. The user comes here for certainty while working.

#### What Reference MUST include

| Principle | Guidance |
| ---------- | --------- |
| Describe and only describe | *"Neutral description is the key imperative of technical reference."* |
| Adopt standard patterns | Consistency over creativity — users rely on muscle memory |
| Respect the structure of the machinery | *"The structure of the documentation should mirror the structure of the product"* |
| Provide examples | Code examples illustrate without explaining; brief usage samples are acceptable |
| Be authoritative and complete | *"Your users need reference material because they need truth and certainty"* |

#### Style requirements

| Attribute | Value |
| ---------- | ------- |
| Tone | Austere, uncompromising, neutral, objective |
| Structure | Mirrors the code/machinery it describes |
| Prose quantity | Minimal — facts and descriptions only |
| Auto-generation | Acceptable and often preferred for API docs |

#### What Reference MUST NOT include

| Anti-pattern | Reason |
| ------------- | -------- |
| Instruction (how-to) | Has its own place; mixing obscures both |
| Explanation (why) | Has its own place; interrupts reference lookup |
| Opinion or narrative | Undermines authority and trust |
| Marketing language | Dangerous in a reference context — *"literally governed by law"* in food analogy |

> *"There should be no doubt or ambiguity in reference; it should be wholly authoritative."* — Procida

#### Good reference language patterns

```
"Django's default logging configuration inherits Python's defaults."  → state facts
"Sub-commands are: a, b, c, d, e, f."                               → enumerate
"You must use a. You must not apply b unless c. Never d."            → state rules/warnings
```

---

### 9.6 Explanation — Detailed Profile

> *"Explanation is a discursive treatment of a subject, that permits reflection. Explanation is understanding-oriented."*  
> *"It's documentation that it makes sense to read while away from the product."* (The bath test)

**Definition**: Background, discussion, contextual understanding. Helps the practitioner build mental models and connect knowledge. The user is in *study* mode, away from the work itself.

**Alternative names** (all acceptable): Discussion, Background, Conceptual guides, Topics.

#### What Explanation MUST include

| Principle | Guidance |
| ---------- | --------- |
| Make connections | Weave a web of understanding; link to related topics |
| Provide context | History, design decisions, technical constraints, implications |
| Talk about the subject (not at it) | Bigger picture, alternatives, possibilities, reasons and justifications |
| Admit opinion and perspective | *"All human activity and knowledge is invested within opinion"* |
| Consider alternatives | *"Discussions can even consider and weigh up contrary opinions"* |
| Keep it closely bounded | Draw clear scope lines; prevent topic sprawl |

#### What Explanation MUST NOT include

| Anti-pattern | Reason |
| ------------- | -------- |
| Step-by-step instructions | Belongs in how-to guides; explanation should not guide action |
| Reference data | Has its own place; explanation is not a data lookup |
| Tutorial sequence | Fundamentally different purpose |
| Unbounded scope | *"Open-endedness can give the writer too many possibilities"* |

> *"No practitioner of a craft can afford to be without an understanding of that craft."* — Procida  
> *"Understanding doesn't come from explanation, but explanation is required to form that web that helps hold everything together."* — Procida

#### Good explanation language patterns

```
"The reason for x is because historically, y …"    → explain causes
"W is better than z, because …"                    → offer judgements
"An x in system y is analogous to a w in system z." → provide context
"Some users prefer w (because z). This can be a good approach, but…" → weigh alternatives
"An x interacts with a y as follows: …"            → unfold internal relationships
```

#### The naming test

Explanation titles should tolerate a prepended *"About"*:
- ✅ *About user authentication*
- ✅ *About database connection policies*
- ❌ *How to authenticate users* (that's a how-to guide)

---

### 9.7 Anti-patterns Catalog

These are the most common documentation quality failures under the Diátaxis lens:

#### Cross-Quadrant Contamination

| Anti-pattern | Description | Harm |
| ------------- | ------------ | ------ |
| **Tutorial masquerading as how-to** | Step-by-step guide written for learners but labelled as task documentation | Fails both learners (no pedagogy) and practitioners (no real-world branching) |
| **How-to guide written as tutorial** | Procedure guide with learning context, teaching language, explanations | Practitioner loses flow; newcomer is misled about prerequisites |
| **Reference with embedded explanation** | API docs that expand into "why" discussions | Obscures description; explanation is orphaned and underdeveloped |
| **Explanation masquerading as reference** | Conceptual guide formatted as a reference table | Neither authoritative nor illuminating |
| **Explanation scattered in tutorials** | Conceptual context embedded in learning exercises | *"Explanation distracts attention from [doing]"* — blocks learning |
| **How-to guide merged with reference** | Step guide appends full option tables | Adds cognitive load; breaks flow |

#### Structural collapse (worst-case scenarios, per Procida)

> *"In the worst case there is a complete or partial collapse of tutorials and how-to guides into each other, making it impossible to meet the needs served by either."*

Natural blur affinities (adjacent quadrants most likely to contaminate each other):

| Pair | Shared trait | Common blur |
| ------ | ------------- | ------------- |
| Tutorials ↔ How-to guides | Both contain action steps | Tutorial written for competent user; how-to guide with excessive teaching |
| Reference ↔ How-to guides | Both serve practitioners at work | Reference bloated with procedural steps |
| Reference ↔ Explanation | Both contain propositional knowledge | Reference drifts into "why" discussion |
| Tutorials ↔ Explanation | Both serve learners at study | Tutorial burdened with conceptual tangents |

#### Naming anti-patterns (how-to guides)

| Bad title pattern | Problem | Fix |
| ------------------ | --------- | ----- |
| Gerund noun phrase: *"Integrating APM"* | Ambiguous — is this how, whether, or what? | Use imperative: *How to integrate APM* |
| Topic noun: *"Application performance monitoring"* | Could be any type | Specify with "How to…" prefix |
| Tool-centric: *"Using the Deploy button"* | No user goal expressed | Reframe around user need |

---

### 9.8 Audit Signals for Documentation Quality

Signals the `audit-documentation` agent should use when evaluating documentation quality through the Diátaxis lens:

#### Presence Audit (Coverage)

| Signal | Finding severity | Rule |
| -------- | ---------------- | ------ |
| No tutorials found | `high` | New users cannot onboard; acquisition of skills unsupported |
| No how-to guides found | `high` | Competent users have no task guidance |
| No reference documentation found | `critical` | Users cannot look up facts; work is blocked |
| No explanation/conceptual docs found | `medium` | Understanding is fragmented; no connective tissue |
| Only one quadrant present | `high` | Systematic coverage failure |
| Two or fewer quadrants present | `medium` | Partial systematic failure |

#### Type Confusion Audit (Quality)

| Signal | Finding severity | Detection heuristic |
| -------- | ---------------- | --------------------- |
| Tutorial contains "How do I…" framing | `medium` | Title or H2 starts with "How do I" or "How to" inside a tutorial file |
| How-to guide uses "you will learn" language | `medium` | Grep for *"you will learn"*, *"by the end of this guide you will"* |
| How-to guide contains background/history section | `low` | Presence of `## Background`, `## Why`, `## About` H2s in how-to |
| Reference page contains step-by-step numbered procedure | `medium` | Ordered list of 3+ items inside a reference page |
| Explanation page contains numbered procedure steps | `medium` | Ordered list of 3+ items inside a conceptual/explanation page |
| Tutorial has no expected-output statements | `low` | Missing "should look like", "you should see", "the output will be" |
| How-to guide title does not start with "How to" | `low` | Title regex: does not match `^How to\b` or `^How do I\b` |

#### Structural/Architecture Audit

| Signal | Finding severity | Detection heuristic |
| -------- | ---------------- | --------------------- |
| No separation between quadrant types (monolithic docs) | `high` | All documentation in a single flat directory with no type categorisation |
| Tutorial links to reference for prerequisites | `info` | Good sign — tutorials should link out rather than embed |
| How-to guide links to explanation for context | `info` | Good sign — guides should not absorb context |
| Reference page architecture does not mirror code structure | `medium` | Reference navigation order differs significantly from module/API structure |
| Explanation not linked from tutorial or how-to | `low` | Orphaned understanding content — users cannot find the "why" |

#### README Completeness (Diátaxis-aligned)

A project README passes the Diátaxis bar when it provides:

| Element | Maps to |
| --------- | --------- |
| Quick start / Getting started section | Tutorial (minimal) |
| Links to task-specific guides | How-to guides |
| Links to API/configuration reference | Reference |
| Architectural overview or rationale | Explanation |

---

### 9.9 The Quality Model

Procida distinguishes two levels of documentation quality:

#### Functional Quality (objective, measurable)

Properties: accuracy, completeness, consistency, usefulness, precision.

- Independently measurable on each dimension
- Failures are immediately apparent to users
- Diátaxis *cannot grant* functional quality, but can **expose lapses in it**

> *"Moving explanatory verbiage out of a tutorial often has the effect of highlighting a section where the reader has been left to work something out for themselves."* — Procida

#### Deep Quality (subjective, experiential)

Properties: feeling good to use, having flow, fitting to human needs, being beautiful, anticipating the user.

- Characteristics are **interdependent** (flow and anticipating the user are aspects of each other)
- Assessment requires judgment, not measurement
- Conditional upon functional quality (you cannot have deep quality without functional quality)
- Diátaxis *directly addresses* deep quality by fitting documentation to user needs and preserving flow

| | Functional Quality | Deep Quality |
| --- | --- | --- |
| Nature | Independent characteristics | Interdependent characteristics |
| Measurability | Objective, measured against the world | Subjective, assessed against the human |
| Role | Condition of deep quality | Conditional upon functional quality |
| Documentation author experience | Constraints | Liberation / creativity |

---

### 9.10 The User Journey (Documentation Cycle)

Procida describes a cycle of documentation needs as expertise develops:

```
1. Learning-oriented phase  → TUTORIALS
   "We begin by learning — diving in to do it under the guidance of a teacher."

2. Goal-oriented phase      → HOW-TO GUIDES
   "Next we want to put the skill to work."

3. Information-oriented phase → REFERENCE
   "As soon as our work calls upon knowledge not already in our head."

4. Understanding-oriented phase → EXPLANATION
   "Away from the work, we reflect on our practice to understand the whole."

→ Back to 1 (new topic or deeper penetration)
```

> *"An actual user may enter the documentation anywhere in search of guidance on some particular subject, and what they want to read will change from moment to moment."* — Procida

---

### 9.11 Source Attribution and References

| Concept | Attribution |
| --------- | ------------ |
| Diátaxis framework (all four quadrants, two axes, compass) | **Daniele Procida**, <https://diataxis.fr/>, © Daniele Procida |
| Tutorial-as-lesson pedagogical model | **Daniele Procida**, <https://diataxis.fr/tutorials/> |
| How-to guide vs. tutorial distinction | **Daniele Procida**, <https://diataxis.fr/tutorials-how-to/> |
| Reference as description | **Daniele Procida**, <https://diataxis.fr/reference/> |
| Explanation as understanding | **Daniele Procida**, <https://diataxis.fr/explanation/> |
| Two axes / foundations | **Daniele Procida**, <https://diataxis.fr/foundations/> |
| Diátaxis compass (decision tool) | **Daniele Procida**, <https://diataxis.fr/compass/> |
| Functional vs. deep quality | **Daniele Procida**, <https://diataxis.fr/quality/> |
| Documentation map and blur | **Daniele Procida**, <https://diataxis.fr/map/> |
| "Grand Unified Theory of Documentation" epithet | **David Laing**, quoted on <https://diataxis.fr/theory/> |

---

## Part X — README Quality Standards

> **Sources**: Billie Thompson (PurpleBooth), Richard Litt (standard-readme), Matias Singers (awesome-readme), Danny Guo (makeareadme.com), GitHub Docs, Tom Preston-Werner (Readme Driven Development), Stephen Whitmore (Art of Readme)

---

### 10.1 Mandatory Sections

These sections MUST be present in any project README. Their absence generates a finding.

| Section | Justification | Source |
| --------- | -------------- | ------- |
| **Title** | Must match repo/package name. Reader's first orientation signal. | PurpleBooth, standard-readme (Required) |
| **Short description** | ≤ 120 chars, no title; tells what the project does in one sentence. Should match GitHub description field. | standard-readme (Required) |
| **Installation** | Exact install commands in a code block. Without this, no one can use the project. | PurpleBooth, standard-readme (Required), makeareadme |
| **Usage** | At least one runnable code example with expected output. "Use examples liberally." | standard-readme (Required), makeareadme |
| **Contributing** | States whether PRs are accepted; links to CONTRIBUTING.md. | standard-readme (Required), makeareadme, GitHub Docs |
| **License** | SPDX identifier + owner. Must be the last section. | standard-readme (Required), makeareadme, GitHub Docs |

**Why each is non-negotiable:**

- **Title** — GitHub, GitLab, Bitbucket surface the README at the repo root; title anchors every search result and link share.
- **Short description** — "The documentation, not the code, defines what a module does." (Ken Williams). Without it, discoverability fails.
- **Installation** — A project that cannot be installed from its README is useless to new contributors.
- **Usage** — Code examples are the highest-signal documentation. A 3-line snippet eliminates more confusion than three paragraphs of prose.
- **Contributing** — GitHub auto-surfaces `CONTRIBUTING.md` in every issue and PR form.
- **License** — Without a license, code is legally "all rights reserved" in most jurisdictions, blocking adoption.

---

### 10.2 Optional but Highly Valuable Sections

| Section | When to include | Value signal |
| --------- | --------------- | ------------ |
| **Badges** (CI, coverage, version, license) | Always for active projects | Quick health at a glance; shields.io is canonical |
| **Table of contents** | READMEs > 100 lines | Navigation; standard-readme requires it above that threshold |
| **Prerequisites / Requirements** | Non-obvious runtime or build dependencies | Prevents wasted setup time |
| **Configuration** | Env vars, config files, or flags required | Critical for operators; often incorrectly omitted |
| **Running tests** | Libraries and tools | Enables contributors to verify changes quickly |
| **Deployment** | Services and applications | Needed by ops personas; PurpleBooth includes it explicitly |
| **API reference** | Libraries | Exported functions, signatures, return types; may link to external docs |
| **Versioning** | Projects with semantic versions | PurpleBooth includes semver reference explicitly |
| **Roadmap** | Active projects seeking contributors | makeareadme recommends it to signal project direction |
| **FAQ / Troubleshooting** | When common issues are known | Reduces support burden |
| **Changelog** | Versioned packages | Keep a Changelog format |
| **Authors / Credits** | Always | Attribution, legal provenance |
| **Project status** | Abandoned/maintenance-only | makeareadme: put at top if project is inactive |
| **Security policy** | Packages with known attack surface | standard-readme: `Security` section before `Background` |
| **Built with / Tech stack** | Applications and services | Context for contributors; PurpleBooth includes it |
| **Architecture diagram** | Complex systems | awesome-readme highlights this as a differentiator |
| **Banner / Logo** | Widely-adopted open source | standard-readme: optional, local image, after title |

---

### 10.3 Audit Signals — Quality Anti-Patterns

#### Structure Anti-Patterns

| Anti-pattern | Description | Example signal |
| ------------- | ------------ | --------------- |
| No description | README starts with badges or title only | `# my-lib` then immediately `## Installation` |
| Prose-only description | Description exists but no code example anywhere | "This library helps with X" — no `` ``` `` blocks |
| Badge-only status | Only badges, no setup instructions | 12 badges, 0 install commands |
| Missing license section | No `## License` or LICENSE file reference | Legal blocker |
| Broken links | Dead links to docs, demos, external resources | 404 on clicking "Read the Docs" |
| Placeholder text | Uncustomized template text still present | "Add additional notes to deploy this on a live system" |
| Title mismatch | README title ≠ repo name or package.json name | standard-readme requires exact match |

#### Content Anti-Patterns

| Anti-pattern | Description |
| ------------- | ------------ |
| Vague install instructions | "Install the dependencies" with no command |
| No OS/version context | Install steps assume specific OS without stating it |
| Outdated commands | Commands reference deprecated APIs, removed flags, or renamed packages |
| No expected output | Usage section shows code but not what it returns or prints |
| Missing prerequisites | Requires Node 20 but README says nothing about it |
| Wall-of-text description | Long description with no structure; no code examples |
| Single-sentence contributing | "PRs welcome." with no process guidance |
| Stale badges | CI badge pointing to a deleted branch or defunct service |

---

### 10.4 Severity Mapping

| Finding | Severity | Rationale |
| --------- | -------- | ---------- |
| No license section or LICENSE file | **critical** | Legal blocker; copyrightable by default without it |
| No installation instructions at all | **critical** | Project is functionally unusable from README alone |
| No description / README is empty or < 50 words | **critical** | GitHub Docs: README is "often the first item a visitor will see" |
| No usage example (no code blocks at all) | **high** | Top reason developers abandon a project |
| Broken links (> 25% of links) | **high** | Erodes trust; GitHub surfaces these as repo health issues |
| Outdated install commands | **high** | Causes immediate failure for new users |
| Missing prerequisites with non-obvious runtime requirements | **high** | Silent failures (e.g., requires Python 3.11+ undocumented) |
| No contributing section or link to CONTRIBUTING.md | **medium** | GitHub auto-links to CONTRIBUTING.md in issue forms |
| Missing table of contents (README > 100 lines) | **medium** | Navigation blocker on long documents |
| No expected output in usage examples | **medium** | Developer cannot verify correct behavior |
| Missing configuration section when env vars are used | **medium** | Breaks first-run experience |
| No tests section for library or tool | **medium** | Signals untestable codebase to contributors |
| Placeholder/template text not removed | **medium** | README was never customized |
| Missing badges on active project | **low** | Cosmetic quality signal |
| Missing roadmap or project status | **low** | Affects contribution interest |
| Missing authors/acknowledgements | **low** | Attribution good practice |
| README < 200 words (not empty) | **low** | Likely incomplete |

---

### 10.5 Stack-Specific Variations

#### Library README (npm, PyPI, Maven, crates.io)

**Required additions:** API reference section (or link), import/require code example as the very first usage block, package manager install command, compatibility matrix, changelog link.

**Omit:** Deployment section, environment variable configuration.

#### Application README (web app, desktop app)

**Required additions:** Environment variables / configuration section, deployment instructions (Docker, cloud, manual), screenshots or GIF demo, tech stack section, prerequisites.

**Omit or deprioritize:** Full API reference (link to separate API docs instead).

#### CLI Tool README

**Required additions:** CLI usage section with `--help` output or flag table, binary download + package manager install, shell examples showing stdin/stdout/stderr behavior, exit code documentation.

#### Monorepo README

**Required additions:** Workspace/package structure overview (tree or table), per-package links to their own READMEs, bootstrap / install-all command, CI matrix if packages released independently.

---

### 10.6 The "5-Minute Test" Checklist

A new developer with no context should be able to answer all of the following within 5 minutes of reading the README alone.

```
ORIENTATION (≤ 30 seconds)
  [ ] What does this project do? (description)
  [ ] Why should I care? (value proposition or motivation)
  [ ] Is this actively maintained? (badges, project status, recent commit)

SETUP (≤ 2 minutes)
  [ ] What are the prerequisites? (OS, runtime, version)
  [ ] How do I install it? (exact commands in a code block)
  [ ] Are there any "gotchas" on my platform?

FIRST RUN (≤ 3 minutes)
  [ ] Can I run the minimal example from the README as-is?
  [ ] Do I know what success looks like? (expected output shown)
  [ ] If something fails, where do I go? (support/issues link)

CONTRIBUTION READINESS
  [ ] Are contributions welcome?
  [ ] Is there a CONTRIBUTING.md?
  [ ] How do I run the tests?
  [ ] Is there a Code of Conduct?

LEGAL
  [ ] What is the license?
  [ ] Can I use this in a commercial project?
```

**Scoring:** 12+ checks passing = Pass. 8–11 = Medium quality. < 8 = Fail.

---

### 10.7 Standard-Readme Section Order (Richard Litt)

The `standard-readme` spec mandates this canonical section order for library READMEs. Sections marked ✓ are **required**; others are optional.

```
1.  Title                ✓ (must match repo/package name)
2.  Banner               (local image, no title, directly after title)
3.  Badges               (no title, newline-delimited)
4.  Short Description    ✓ (< 120 chars, no title, own line)
5.  Long Description     (motivation, abstract deps)
6.  Table of Contents    ✓ (required if README > 100 lines)
7.  Security             (if important enough to highlight early)
8.  Background           (motivation, intellectual provenance)
9.  Install              ✓ (code block; Dependencies subsection if needed)
10. Usage                ✓ (code block; CLI subsection if applicable)
11. Extra Sections       (0 or more domain-specific sections)
12. API                  (exported functions, types, signatures)
13. Maintainer(s)        (current owners with contact)
14. Thanks / Credits     (significant contributors)
15. Contributing         ✓ (PR policy, questions, CoC link)
16. License              ✓ (must be last; SPDX identifier + owner)
```

---

### 10.8 PurpleBooth Template Structure (Billie Thompson)

The "A Good README Template" by Billie Thompson (PurpleBooth) defines this structure for application/project READMEs:

```
# Project Title
One paragraph description

## Getting Started
### Prerequisites
### Installing (step-by-step code blocks through to demo)

## Running the tests
### Sample Tests
### Style test

## Deployment

## Built With

## Contributing (→ CONTRIBUTING.md)

## Versioning (semantic versioning)

## Authors

## License

## Acknowledgments
```

**Key PurpleBooth principles:**
- Every section with sub-steps includes a code block
- Installation section ends with a working demo, not just a command
- Deployment is explicitly a first-class section (not buried in docs)
- Versioning section links to the tags page

---

### 10.9 Quick Reference: README Finding IDs

| Condition | Finding ID pattern | Severity |
| ----------- | ------------------ | -------- |
| README file missing entirely | `DOC-001` | critical |
| README has < 50 words | `DOC-002` | critical |
| No license section, no LICENSE file | `DOC-003` | critical |
| No installation section | `DOC-004` | critical |
| No usage section or no code block | `DOC-005` | high |
| Broken external links | `DOC-006` | high |
| Install commands reference non-existent script/package | `DOC-007` | high |
| Missing prerequisites for non-trivial runtime | `DOC-008` | high |
| No contributing section or CONTRIBUTING.md | `DOC-009` | medium |
| README > 100 lines, no table of contents | `DOC-010` | medium |
| No expected output in usage examples | `DOC-011` | medium |
| Missing config/env-var section for configurable project | `DOC-012` | medium |
| No test-running instructions for library/tool | `DOC-013` | medium |
| Placeholder/template text not removed | `DOC-014` | medium |
| No CI/build badge for active project | `DOC-015` | low |
| Missing roadmap or project status | `DOC-016` | low |
| Missing authors/acknowledgements section | `DOC-017` | low |
| README < 200 words (not empty) | `DOC-018` | low |

---

### 10.10 Source Attribution

| Source | Author | URL | Key contribution |
| -------- | ------- | ----- | ---------------- |
| A Good README Template | Billie Thompson (PurpleBooth) | <https://github.com/PurpleBooth/a-good-readme-template> | Canonical template structure |
| Standard Readme | Richard Litt | <https://github.com/RichardLitt/standard-readme> | Formal specification with required/optional tags; linter; generator |
| Awesome README | Matias Singers | <https://github.com/matiassingers/awesome-readme> | Curated gallery of exemplary READMEs; 20.5k stars |
| Make a README | Danny Guo | <https://www.makeareadme.com/> | Beginner-friendly guide with live editable template |
| About READMEs | GitHub | <https://docs.github.com/en/repositories/managing-your-repositorys-settings-and-features/customizing-your-repository/about-readmes> | Platform behavior: surfacing rules, 500KiB limit, profile READMEs |
| Art of Readme | Stephen Whitmore (hackergrrl) | <https://github.com/hackergrrl/art-of-readme> | Essay on README philosophy |
| Readme Driven Development | Tom Preston-Werner | <https://tom.preston-werner.com/2010/08/23/readme-driven-development.html> | Argues README should be written before code |
