import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { findingsResponse, withErrorHandling } from "./response.js";
import { STANDARD_INPUT_SCHEMA, FINDINGS_TOOL_META } from "./schemas.js";
import { checkI18n } from "../tools/i18n.js";
import { validateProjectDir } from "../utils/paths.js";
import { loadProjectConfig, resolveConfig } from "../utils/project-config.js";

/**
 * Registers all i18n-domain MCP tools on the given server instance.
 */
export function registerI18nTools(server: McpServer): void {
  server.registerTool(
    "inspectra_check_i18n",
    {
      title: "Check Internationalization",
      description: `Scan templates and source files for i18n issues: hardcoded user-facing strings and missing i18n library setup.

Checks for: text nodes in HTML/JSX/TSX templates that are not wrapped in an i18n pipe or translation function (when an i18n library is already in use), and projects that have no i18n library configured at all.

Supports: Angular (ngx-translate, built-in i18n), React (react-i18next, react-intl), and Vue (vue-i18n).

Args:
  - projectDir (string): Absolute path to the project root.

Returns: Array of Finding objects (domain: "i18n", prefix: INT-). Each finding includes affected file paths and remediation guidance.

Error handling:
  - Throws if projectDir does not exist or is not a directory.

Examples:
  1. Check i18n in an Angular project:
     { "projectDir": "/app/my-angular-app" }
  2. Check i18n in a React project:
     { "projectDir": "/app/my-react-app" }`,
      inputSchema: STANDARD_INPUT_SCHEMA,
      ...FINDINGS_TOOL_META,
    },
    withErrorHandling(async ({ projectDir, responseFormat, limit, offset }) => {
      const safeDir = await validateProjectDir(projectDir);
      const config = resolveConfig(await loadProjectConfig(safeDir));
      const findings = await checkI18n(safeDir, config.ignore_dirs);
      return findingsResponse(findings, responseFormat, { limit, offset });
    }, "inspectra_check_i18n"),
  );
}
