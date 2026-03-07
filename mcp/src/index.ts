import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { createRequire } from "node:module";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { registerSecurityTools } from "./register/security.js";
import { registerTestsTools } from "./register/tests.js";
import { registerArchitectureTools } from "./register/architecture.js";
import { registerConventionsTools } from "./register/conventions.js";
import { registerPerformanceTools } from "./register/performance.js";
import { registerDocumentationTools } from "./register/documentation.js";
import { registerTechDebtTools } from "./register/tech-debt.js";
import { registerMergerTools } from "./register/merger.js";
import { registerRendererTools } from "./register/renderer.js";
import { registerGovernanceTools } from "./register/governance.js";
import { registerAccessibilityTools } from "./register/accessibility.js";
import { registerApiDesignTools } from "./register/api-design.js";
import { registerObservabilityTools } from "./register/observability.js";
import { registerI18nTools } from "./register/i18n.js";
import { registerUxConsistencyTools } from "./register/ux-consistency.js";
import { registerAdapterTools } from "./register/adapter.js";
import { registerResources } from "./register/resources.js";
import { registerPrompts } from "./register/prompts.js";
import { SERVER_NAME } from "./constants.js";
import { logger } from "./logger.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const POLICIES_DIR = resolve(__dirname, "..", "..", "policies");
const SCHEMAS_DIR = resolve(__dirname, "..", "..", "schemas");
const PROMPTS_DIR = resolve(__dirname, "..", "..", ".github", "prompts");
const { version: SERVER_VERSION } = createRequire(import.meta.url)("../package.json") as { version: string };

const server = new McpServer({
  name: SERVER_NAME,
  version: SERVER_VERSION,
});

// ─── Register all domain tools ───────────────────────────────────────────────

registerSecurityTools(server, POLICIES_DIR);
registerTestsTools(server, POLICIES_DIR);
registerArchitectureTools(server, POLICIES_DIR);
registerConventionsTools(server, POLICIES_DIR);
registerPerformanceTools(server);
registerDocumentationTools(server);
registerTechDebtTools(server, POLICIES_DIR);
registerMergerTools(server, POLICIES_DIR);
registerRendererTools(server);
registerGovernanceTools(server);
registerAccessibilityTools(server);
registerApiDesignTools(server);
registerObservabilityTools(server);
registerI18nTools(server);
registerUxConsistencyTools(server);
registerAdapterTools(server);

// ─── Register resources ──────────────────────────────────────────────────────

registerResources(server, POLICIES_DIR, SCHEMAS_DIR);

// ─── Register prompts ────────────────────────────────────────────────────────

registerPrompts(server, PROMPTS_DIR);

// ─── Start Server ─────────────────────────────────────────────────────────────

async function main(): Promise<void> {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  logger.info(`${SERVER_NAME} v${SERVER_VERSION} running on stdio`);
}

main().catch((error) => {
  logger.error("Failed to start Inspectra MCP server", { error: String(error) });
  process.exit(1);
});
