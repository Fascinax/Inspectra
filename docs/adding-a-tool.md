# Adding an MCP Tool

This guide explains how to add a new audit tool to the Inspectra MCP server.

## Steps

### 1. Choose the Domain

Decide which domain the tool belongs to: `security`, `tests`, `architecture`, `conventions`, `performance`, `documentation`, `tech-debt`, `accessibility`, `api-design`, `observability`, `i18n`, or `ux-consistency`. Each domain has corresponding files in `mcp/src/tools/`.

### 2. Implement the Tool Function

Add your function to the appropriate domain file. The function must:

- Accept clear input parameters (typically a project directory path and optional `ignoreDirs`).
- Return `Finding[]` — an array of findings conforming to the schema.
- Handle errors gracefully (never throw — return an empty array on failure).
- Use `FindingBuilder` from `utils/finding-builder.ts` for constructing findings.
- Use shared constants from `utils/shared-constants.ts` (`MAX_SNIPPET_LENGTH`, `SUPPORTED_EXTENSIONS`, `TEST_INFRA_PATH`).

```typescript
// mcp/src/tools/security-my-check.ts
import type { Finding } from "../types.js";
import { createIdSequence } from "../utils/id.js";
import { finding } from "../utils/finding-builder.js";
import { MAX_SNIPPET_LENGTH, SUPPORTED_EXTENSIONS } from "../utils/shared-constants.js";

export async function myNewSecurityCheck(
  projectDir: string,
  ignoreDirs?: string[],
): Promise<Finding[]> {
  const nextId = createIdSequence("SEC", 200); // unique range to avoid ID collisions
  const findings: Finding[] = [];

  // ... analysis logic ...

  findings.push(
    finding(nextId)
      .severity("medium")
      .title("Description of the issue")
      .domain("security")
      .rule("my-new-rule")
      .confidence(0.85)
      .file("path/to/file.ts", 42, "suspicious code snippet")
      .recommendation("How to fix it.")
      .effort("small")
      .tags(["relevant-tag"])
      .build(),
  );

  return findings;
}
```

### 3. Register the Tool in the MCP Server

Add the tool registration in the appropriate `mcp/src/register/*.ts` file. Use the handler factory to reduce boilerplate:

```typescript
// mcp/src/register/security.ts
import { myNewSecurityCheck } from "../tools/security-my-check.js";
import { createConfigHandler } from "./handler-factory.js";
import { STANDARD_INPUT_SCHEMA, FINDINGS_TOOL_META } from "./schemas.js";

// Inside the register function:
server.registerTool(
  "inspectra_my_new_check",
  {
    title: "My New Security Check",
    description: "Description of what this tool does.\n\nArgs:\n  - projectDir (string): Absolute path to the project root.",
    inputSchema: STANDARD_INPUT_SCHEMA,
    ...FINDINGS_TOOL_META,
  },
  createConfigHandler("inspectra_my_new_check", myNewSecurityCheck),
);
```

Three handler factories are available:

- `createStandardHandler(toolName, fn)` — validates dir, calls `fn(dir)`, returns paginated response.
- `createConfigHandler(toolName, fn)` — same + loads `.inspectrarc.yml` and passes `ignoreDirs` to `fn(dir, ignoreDirs)`.
- `createProfiledHandler(toolName, policiesDir, fn)` — same + loads a profile and passes it to `fn(dir, profileConfig)`.

### 4. Expose the Tool Through Prompt Workflows

Update the relevant prompt under `.github/prompts/` so the new tool is considered by `/audit`, `/audit-pr`, or `/audit-domain` when it applies.

### 5. Update copilot-instructions.md

Add the tool to the MCP tools table in `.github/copilot-instructions.md`.

### 6. Build and Test

```bash
cd mcp
npm run build
# Test the tool manually or with the test suite
```

## Conventions

- Tool names use kebab-case: `check-something`, `scan-something`.
- Finding IDs use the domain prefix: `SEC-XXX`, `TST-XXX`, `ARC-XXX`, `CNV-XXX`.
- Use non-overlapping ID ranges across tools in the same domain.
- Always set `confidence` based on how certain the detection is.
- Always include at least one `evidence` entry with a file path.
