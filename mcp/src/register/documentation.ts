import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { jsonResponse } from "./response.js";
import { FindingsOutputSchema } from "./schemas.js";
import { checkReadmeCompleteness, checkAdrPresence, detectDocCodeDrift } from "../tools/documentation.js";
import { validateProjectDir } from "../utils/paths.js";

/**
 * Registers all documentation-domain MCP tools on the given server instance.
 */
export function registerDocumentationTools(server: McpServer): void {
  server.registerTool(
    "inspectra_check_readme_completeness",
    {
      title: "Check README Completeness",
      description: `Evaluate README presence and completeness against a baseline set of expected sections.

Checks for: project description, installation instructions, usage examples, API documentation, contributing guidelines, and license. Each missing section produces a finding.

Args:
  - projectDir (string): Absolute path to the project root.

Returns: Array of Finding objects (domain: "documentation", prefix: DOC-). Each finding identifies the missing README section and its importance level.

Error handling:
  - Returns a single critical finding if no README file exists.
  - Throws if projectDir does not exist or is not a directory.`,
      inputSchema: {
        projectDir: z.string().describe("Absolute path to the project root"),
      },
      outputSchema: FindingsOutputSchema,
      annotations: {
        readOnlyHint: true,
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: false,
      },
    },
    async ({ projectDir }) => {
      const safeDir = await validateProjectDir(projectDir);
      const findings = await checkReadmeCompleteness(safeDir);
      return jsonResponse(findings);
    },
  );

  server.registerTool(
    "inspectra_check_adr_presence",
    {
      title: "Check ADR Presence",
      description: `Check whether Architecture Decision Records are present in the project.

Looks for ADR documents under docs/adr, docs/adrs, and doc/architecture/decisions directories. Verifies that at least one ADR exists and follows the standard template format.

Args:
  - projectDir (string): Absolute path to the project root.

Returns: Array of Finding objects (domain: "documentation", prefix: DOC-). Reports a finding if no ADR directory or documents are found.

Error handling:
  - Throws if projectDir does not exist or is not a directory.`,
      inputSchema: {
        projectDir: z.string().describe("Absolute path to the project root"),
      },
      outputSchema: FindingsOutputSchema,
      annotations: {
        readOnlyHint: true,
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: false,
      },
    },
    async ({ projectDir }) => {
      const safeDir = await validateProjectDir(projectDir);
      const findings = await checkAdrPresence(safeDir);
      return jsonResponse(findings);
    },
  );

  server.registerTool(
    "inspectra_detect_doc_code_drift",
    {
      title: "Detect Doc-Code Drift",
      description: `Detect mismatches between package.json scripts and README usage instructions.

Compares the scripts defined in package.json (or pom.xml/build.gradle) with the commands documented in README. Identifies scripts referenced in docs that no longer exist and scripts missing from documentation.

Args:
  - projectDir (string): Absolute path to the project root.

Returns: Array of Finding objects (domain: "documentation", prefix: DOC-). Each finding identifies the drifted script name, whether it is missing from docs or from the manifest, and a recommended action.

Error handling:
  - Returns empty findings if no package.json or README is found.
  - Throws if projectDir does not exist or is not a directory.`,
      inputSchema: {
        projectDir: z.string().describe("Absolute path to the project root"),
      },
      outputSchema: FindingsOutputSchema,
      annotations: {
        readOnlyHint: true,
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: false,
      },
    },
    async ({ projectDir }) => {
      const safeDir = await validateProjectDir(projectDir);
      const findings = await detectDocCodeDrift(safeDir);
      return jsonResponse(findings);
    },
  );
}