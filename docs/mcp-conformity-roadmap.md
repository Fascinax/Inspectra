# Roadmap conformité MCP — Actions restantes

> Basé sur l'évaluation Architecture MCP, enrichie par le skill **mcp-builder** (réf. `mcp_best_practices.md`, `node_mcp_server.md`).
>
> **Date** : mars 2026 — **Version actuelle** : 0.3.0

---

## Récapitulatif : ce qui est FAIT

| # | Correction | Commit | Statut |
| --- | ----------- | -------- | -------- |
| 1 | Migration `server.tool()` → `server.registerTool()` avec `title` + `annotations` | `01e9f1d` | ✅ |
| 2 | Renommage 28 outils en `snake_case` avec préfixe `inspectra_` | `9654768` | ✅ |
| 3 | Descriptions multi-paragraphes (Args / Returns / Error handling) + `outputSchema` | `e17955d` | ✅ |
| 4 | `Zod .strict()` + `.describe()` + `.min(1)` sur tous les schémas (`types.ts`) | `43e24ee` | ✅ |
| 5 | `CHARACTER_LIMIT` (100k), `errorResponse()`, `withErrorHandling()` sur les 28 handlers | `7a903c3` | ✅ |

**Score de conformité estimé : ~6.5/10** (vs. 3.5/10 avant corrections)

---

## Actions restantes

### Priorité 1 — Haute valeur, effort modéré

#### 1.1 `structuredContent` dans les réponses outil

**Réf. mcp-builder** : *"Return both text content and structured data when using modern SDKs"*, *"Use `structuredContent` in tool responses"*

**État actuel** : `jsonResponse()` retourne uniquement `{ content: [{ type: "text", text }] }`. Le champ `structuredContent` n'est jamais renseigné.

**Action** :

- Modifier `jsonResponse(data)` dans `response.ts` pour retourner aussi `structuredContent: data`
- Cela donne aux clients MCP un accès programmatique direct aux données sans re-parser le JSON texte

**Effort** : XS (1 ligne dans `response.ts`)

---

#### 1.2 Support dual format (JSON / Markdown) via `response_format`

**Réf. mcp-builder** : *"All tools that return data should support multiple formats"*, *"JSON for programmatic processing, Markdown for human readability"*

**État actuel** : Tous les outils retournent exclusivement du JSON. Le renderer Markdown existe mais n'est utilisé que par le CLI, pas par les outils MCP eux-mêmes.

**Action** :

- Ajouter un paramètre optionnel `response_format: z.enum(["json", "markdown"]).default("json")` aux outils qui retournent des findings
- Dans le handler, formater le `text` content en Markdown si demandé (réutiliser les renderers existants)
- Garder `structuredContent` en JSON dans tous les cas

**Effort** : M (touche tous les register files + création d'un formateur findings→markdown)

---

#### 1.3 Extraire `CHARACTER_LIMIT` dans un fichier `constants.ts`

**Réf. mcp-builder** : *"Add a CHARACTER_LIMIT constant"* — doit résider dans `src/constants.ts`, pas dans `response.ts`

**État actuel** : `CHARACTER_LIMIT` est défini dans `response.ts`.

**Action** :

- Créer `mcp/src/constants.ts` avec `CHARACTER_LIMIT` et autres constantes partagées (ex. `SERVER_NAME`, `DEFAULT_PROFILE`)
- Re-exporter depuis `response.ts` ou importer directement

**Effort** : XS

---

#### 1.4 Troncation intelligente avec message d'action

**Réf. mcp-builder** : *"truncate with clear messages"*, *"Use 'offset' parameter or add filters to see more results"*

**État actuel** : La troncation coupe brutalement le JSON et ajoute `"... [truncated at CHARACTER_LIMIT]"`. Le JSON résultant est invalide et ne guide pas l'agent.

**Action** :

- Au lieu de couper le texte, réduire le tableau de findings (ex. garder les N premiers)
- Retourner un JSON valide avec un champ `truncated: true` et `truncation_message`
- Inclure `total_count` et `returned_count` pour que l'agent sache qu'il manque des données

**Effort** : S

---

### Priorité 2 — Conformité avancée

#### 2.1 Renommer le package npm

**Réf. mcp-builder** : *"Node/TypeScript: Use format `{service}-mcp-server`"*

**État actuel** : Le package s'appelle `@inspectra/mcp-server`.

**Action** :

- Renommer en `inspectra-mcp-server` dans `mcp/package.json`
- Mettre à jour les références (Docker, scripts, `inspectra: file:..`)

**Effort** : XS — mais **impact potentiel** sur les consommateurs existants. À évaluer si la convention est strictement requise dans le contexte du projet.

---

#### 2.2 Enregistrer des Resources MCP

**Réf. mcp-builder** : *"Resources: For data access with simple URI-based parameters"*

**État actuel** : Aucune Resource MCP n'est enregistrée. Les agents n'ont accès qu'aux Tools.

**Actions** :

- `inspectra://policies/{profile}` — expose le contenu d'un profil en lecture
- `inspectra://schemas/{name}` — expose les JSON Schemas en lecture
- `inspectra://reports/latest` — expose le dernier rapport consolidé

**Effort** : M (nouveau module `register/resources.ts`, ~80 lignes)

---

#### 2.3 Enregistrer des Prompts MCP

**Réf. mcp-builder** : Prompts sont une primitive du protocole MCP, pas encore exploitée.

**État actuel** : Les prompts sont des fichiers `.prompt.md` dans `.github/prompts/`. Ils ne sont pas exposés via le protocole MCP.

**Action** :

- Utiliser `server.registerPrompt()` pour exposer les workflows d'audit (full, PR, targeted) comme des prompts MCP
- Permet aux clients compatibles de proposer ces workflows dans leur UI

**Effort** : S

---

#### 2.4 Pagination des résultats

**Réf. mcp-builder** : *"Always respect `limit` parameter"*, *"Return `has_more`, `next_offset`, `total_count`"*

**État actuel** : Les outils retournent TOUS les findings d'un coup. Pas de `limit` / `offset`.

**Action** :

- Ajouter `limit` (default: 50) et `offset` (default: 0) aux tools qui retournent des findings
- Retourner `{ findings, total, count, has_more, next_offset }`
- Gère le cas des projets avec des centaines de findings

**Effort** : M (schéma paginé partagé + adaptation des 26 tools findings)

---

#### 2.5 Exemples dans les descriptions d'outils

**Réf. mcp-builder** : *"Descriptions include return value examples"*, *"Include working examples (at least 3 per major feature)"*

**État actuel** : Les descriptions contiennent Args/Returns/Error handling, mais pas d'exemples de valeurs ni de cas d'usage concrets.

**Action** :

- Ajouter une section `Examples:` aux descriptions des outils clés (scan_secrets, parse_coverage, merge_domain_reports, check_layering)
- Format : `"Use when: 'Audit all TS files for secrets' -> params with filePathsCsv='/app/src/auth.ts,/app/src/config.ts'"`

**Effort** : S

---

### Priorité 3 — Qualité & robustesse

#### 3.1 Messages d'erreur actionnables

**Réf. mcp-builder** : *"Error messages should guide agents toward solutions with specific suggestions and next steps"*

**État actuel** : `withErrorHandling` retourne `{ error: error.message }`. Le message brut de l'exception n'est pas toujours actionnable.

**Action** :

- Créer une hiérarchie d'erreurs métier (`InvalidPathError`, `ProfileNotFoundError`, `ParseError`)
- Chaque erreur porte un `suggestion` (ex. *"Check that the path exists and is not a symlink"*)
- `errorResponse()` inclut `{ error, suggestion, tool_name }`

**Effort** : M

---

#### 3.2 Validation des inputs Zod avec messages personnalisés

**Réf. mcp-builder** : *"All Zod schemas have proper constraints and descriptive error messages"*

**État actuel** : Les inputs utilisent `z.string().describe(...)` mais pas de messages Zod personnalisés (`.min(1, "projectDir is required")`).

**Action** :

- Ajouter des messages Zod explicites sur les contraintes : `.min(1, "projectDir cannot be empty")`, `.regex(/.../,"Invalid path format")`

**Effort** : S

---

#### 3.3 Logging sur stderr

**Réf. mcp-builder** : *"stdio servers should NOT log to stdout (use stderr for logging)"*

**État actuel** : Le serveur utilise `console.error` dans `index.ts` (correct), mais les tools n'ont aucun logging.

**Action** :

- Ajouter un logger léger (stderr-only) utilisable dans les handlers pour tracer les appels et les erreurs
- Utile pour le debug sans polluer le flux MCP

**Effort** : S

---

#### 3.4 Tests d'intégration MCP (Inspector)

**Réf. mcp-builder** : *"Test with MCP Inspector: `npx @modelcontextprotocol/inspector`"*

**État actuel** : 177 tests unitaires, mais aucun test d'intégration via le protocole MCP réel.

**Action** :

- Ajouter un script `scripts/test-mcp-inspector.sh` qui lance le serveur et vérifie les tool listings
- Optionnel : tests automatisés avec `@modelcontextprotocol/inspector` en CI

**Effort** : M

---

#### 3.5 Évaluations MCP (Phase 4 du skill)

**Réf. mcp-builder** : *"Create 10 Evaluation Questions"* — Phase 4 du workflow

**État actuel** : Aucune évaluation formelle.

**Action** :

- Créer 10 questions d'évaluation réalistes testant des workflows multi-outils
- Format XML conforme au guide d'évaluation MCP
- Exemple : *"Given a project with 3 critical security findings and 80% coverage, what grade would Inspectra assign?"*

**Effort** : M

---

### Priorité 4 — Nice-to-have

#### 4.1 Transport Streamable HTTP

**Réf. mcp-builder** : *"Streamable HTTP: For remote servers, multi-client scenarios"*

**État actuel** : Uniquement stdio.

**Action** :

- Ajouter un mode HTTP avec `StreamableHTTPServerTransport` activable via variable d'env `TRANSPORT=http`
- Utile pour un déploiement serveur (CI, plateforme SaaS)

**Effort** : M

---

#### 4.2 Notifications MCP

**Réf. mcp-builder** : *"Notify clients when server state changes"*

**État actuel** : Aucune notification.

**Action** :

- Émettre `notifications/tools/list_changed` si les profils changent à chaud
- Peu d'intérêt pour le mode stdio actuel, mais pertinent si HTTP est ajouté

**Effort** : S

---

#### 4.3 Sécurité renforcée (DNS rebinding, rate limiting)

**Réf. mcp-builder** : *"DNS rebinding protection"*, *"Rate limiting"*

**État actuel** : Non applicable en stdio. Deviendrait critique si le transport HTTP est ajouté.

**Action** :

- Préparer les middlewares Express (CORS, DNS rebinding, rate limit) pour le futur mode HTTP
- `127.0.0.1` binding par défaut

**Effort** : S (quand HTTP sera implémenté)

---

## Matrice résumée

| # | Action | Priorité | Effort | Impact Conformité |
| --- | -------- | ---------- | -------- | ------------------- |
| 1.1 | `structuredContent` | P1 | XS | +0.5 |
| 1.2 | Dual format JSON/Markdown | P1 | M | +0.5 |
| 1.3 | Extraire `constants.ts` | P1 | XS | +0.1 |
| 1.4 | Troncation intelligente | P1 | S | +0.3 |
| 2.1 | Renommer package npm | P2 | XS | +0.1 |
| 2.2 | Resources MCP | P2 | M | +0.5 |
| 2.3 | Prompts MCP | P2 | S | +0.3 |
| 2.4 | Pagination | P2 | M | +0.4 |
| 2.5 | Exemples dans descriptions | P2 | S | +0.2 |
| 3.1 | Erreurs actionnables | P3 | M | +0.3 |
| 3.2 | Messages Zod personnalisés | P3 | S | +0.1 |
| 3.3 | Logging stderr | P3 | S | +0.1 |
| 3.4 | Tests MCP Inspector | P3 | M | +0.2 |
| 3.5 | Évaluations MCP (10 Q&A) | P3 | M | +0.3 |
| 4.1 | Transport HTTP | P4 | M | +0.3 |
| 4.2 | Notifications MCP | P4 | S | +0.1 |
| 4.3 | Sécurité HTTP | P4 | S | +0.1 |

**Score potentiel après toutes les actions : ~10/10**

---

## Ordre d'exécution recommandé

```markdown
Sprint 1 (quick wins)     → 1.1, 1.3, 1.4           (~2h)  → score ~7.4
Sprint 2 (dual format)    → 1.2, 2.5                 (~4h)  → score ~8.1
Sprint 3 (MCP primitives) → 2.2, 2.3                 (~4h)  → score ~8.9
Sprint 4 (pagination)     → 2.4, 3.2                 (~4h)  → score ~9.4
Sprint 5 (robustesse)     → 3.1, 3.3, 3.4            (~6h)  → score ~9.8
Sprint 6 (évals & HTTP)   → 3.5, 4.1, 4.2, 4.3      (~8h)  → score ~10
```
