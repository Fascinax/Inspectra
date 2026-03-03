# Adding an MCP Tool

This guide explains how to add a new audit tool to the Inspectra MCP server.

## Steps

### 1. Choose the Domain

Decide which domain the tool belongs to: `security`, `tests`, `architecture`, or `code-quality`. Each domain has a corresponding file in `mcp/src/tools/`.

### 2. Implement the Tool Function

Add your function to the appropriate domain file. The function must:

- Accept clear input parameters (typically a project directory path or file paths).
- Return `Finding[]` — an array of findings conforming to the schema.
- Handle errors gracefully (never throw — return an empty array on failure).

```typescript
// mcp/src/tools/security.ts

export async function myNewSecurityCheck(projectDir: string): Promise<Finding[]> {
  const findings: Finding[] = [];
  let counter = 200; // use a unique range to avoid ID collisions

  // ... analysis logic ...

  findings.push({
    id: `SEC-${String(counter++).padStart(3, "0")}`,
    severity: "medium",
    title: "Description of the issue",
    domain: "security",
    rule: "my-new-rule",
    confidence: 0.85,
    evidence: [{ file: "path/to/file.ts", line: 42 }],
    recommendation: "How to fix it.",
    effort: "small",
    tags: ["relevant-tag"],
  });

  return findings;
}
```

### 3. Register the Tool in the MCP Server

Add the tool registration in `mcp/src/index.ts`:

```typescript
import { myNewSecurityCheck } from "./tools/security.js";

server.tool(
  "my-new-check",                               // tool name
  "Description of what this tool does",          // description
  { projectDir: z.string() },                   // input schema
  async ({ projectDir }) => {
    const findings = await myNewSecurityCheck(projectDir);
    return { content: [{ type: "text", text: JSON.stringify(findings, null, 2) }] };
  }
);
```

### 4. Update the Agent Profile

Add the new tool to the relevant agent's `tools` list in `.github/agents/`:

```yaml
tools:
  - read
  - search
  - inspectra/inspectra_scan_secrets
  - inspectra/inspectra_check_deps_vulns
  - inspectra/my-new-check        # ← add here
```

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
