import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { findingsResponse, withErrorHandling } from "./response.js";
import { STANDARD_INPUT_SCHEMA, FINDINGS_TOOL_META } from "./schemas.js";
import { checkUxConsistency } from "../tools/ux-consistency.js";
import { validateProjectDir } from "../utils/paths.js";
import { loadProjectConfig, resolveConfig } from "../utils/project-config.js";

/**
 * Registers all ux-consistency-domain MCP tools on the given server instance.
 */
export function registerUxConsistencyTools(server: McpServer): void {
  server.registerTool(
    "inspectra_check_ux_consistency",
    {
      title: "Check UX Consistency",
      description: `Scan stylesheets and templates for design system consistency violations.

Checks for: hardcoded color values instead of design tokens, inline style proliferation, magic z-index values, box-shadow sprawl, font family proliferation, font size sprawl, inconsistent transition durations, missing prefers-reduced-motion support, and breakpoint inconsistencies.

Supports: CSS, SCSS, Less stylesheets and HTML/JSX/TSX templates. Automatically skips token/variable definition files to avoid false positives.

Args:
  - projectDir (string): Absolute path to the project root.

Returns: Array of Finding objects (domain: "ux-consistency", prefix: UX-). Each finding includes affected file paths, line numbers, and concrete remediation suggestions.

Error handling:
  - Throws if projectDir does not exist or is not a directory.

Examples:
  1. Check UX consistency in an Angular project:
     { "projectDir": "/app/my-angular-app" }
  2. Check UX consistency with markdown output:
     { "projectDir": "/app/my-project", "responseFormat": "markdown" }`,
      inputSchema: STANDARD_INPUT_SCHEMA,
      ...FINDINGS_TOOL_META,
    },
    withErrorHandling(async ({ projectDir, responseFormat, limit, offset }) => {
      const safeDir = await validateProjectDir(projectDir);
      const config = resolveConfig(await loadProjectConfig(safeDir));
      const findings = await checkUxConsistency(safeDir, config.ignore_dirs);
      return findingsResponse(findings, responseFormat, { limit, offset });
    }, "inspectra_check_ux_consistency"),
  );
}
