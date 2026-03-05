import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { findingsResponse, withErrorHandling } from "./response.js";
import { STANDARD_INPUT_SCHEMA, FINDINGS_TOOL_META } from "./schemas.js";
import { checkA11yTemplates } from "../tools/accessibility.js";
import { validateProjectDir } from "../utils/paths.js";
import { loadProjectConfig, resolveConfig } from "../utils/project-config.js";

/**
 * Registers all accessibility-domain MCP tools on the given server instance.
 */
export function registerAccessibilityTools(server: McpServer): void {
  server.registerTool(
    "inspectra_check_a11y_templates",
    {
      title: "Check Accessibility in Templates",
      description: `Scan HTML, Angular, and JSX/TSX templates for common accessibility violations.

Checks for: images without alt text, empty interactive elements (button/anchor) without accessible names, root HTML element missing lang attribute, and form inputs without labels or ARIA attributes.

Args:
  - projectDir (string): Absolute path to the project root.

Returns: Array of Finding objects (domain: "accessibility", prefix: ACC-). Each finding includes the file path, line number, and a concrete remediation suggestion.

Error handling:
  - Throws if projectDir does not exist or is not a directory.

Examples:
  1. Check accessibility in templates:
     { "projectDir": "/app/my-angular-project" }
  2. Return markdown-formatted results:
     { "projectDir": "/app/my-project", "responseFormat": "markdown" }`,
      inputSchema: STANDARD_INPUT_SCHEMA,
      ...FINDINGS_TOOL_META,
    },
    withErrorHandling(async ({ projectDir, responseFormat, limit, offset }) => {
      const safeDir = await validateProjectDir(projectDir);
      const config = resolveConfig(await loadProjectConfig(safeDir));
      const findings = await checkA11yTemplates(safeDir, config.ignore_dirs);
      return findingsResponse(findings, responseFormat, { limit, offset });
    }, "inspectra_check_a11y_templates"),
  );
}
