import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { createRequire } from "node:module";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { registerSecurityTools } from "./register/security.js";
import { registerTestsTools } from "./register/tests.js";
import { registerArchitectureTools } from "./register/architecture.js";
import { registerConventionsTools } from "./register/conventions.js";
import { registerMergerTools } from "./register/merger.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const POLICIES_DIR = resolve(__dirname, "..", "..", "policies");
const { version: SERVER_VERSION } = createRequire(import.meta.url)("../package.json") as { version: string };

const server = new McpServer({
  name: "inspectra",
  version: SERVER_VERSION,
});

// ─── Register all domain tools ───────────────────────────────────────────────

registerSecurityTools(server, POLICIES_DIR);
registerTestsTools(server, POLICIES_DIR);
registerArchitectureTools(server, POLICIES_DIR);
registerConventionsTools(server, POLICIES_DIR);
registerMergerTools(server, POLICIES_DIR);

// ─── Start Server ─────────────────────────────────────────────────────────────

async function main(): Promise<void> {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error("Inspectra MCP server running on stdio");
}

main().catch((error) => {
  console.error("Failed to start Inspectra MCP server:", error);
  process.exit(1);
});
