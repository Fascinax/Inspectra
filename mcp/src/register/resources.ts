import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { ResourceTemplate } from "@modelcontextprotocol/sdk/server/mcp.js";
import { readFile, readdir } from "node:fs/promises";
import { join } from "node:path";

const AVAILABLE_PROFILES = ["generic", "java-backend", "java-angular-playwright", "angular-frontend"];
const AVAILABLE_SCHEMAS = ["finding", "domain-report", "consolidated-report", "scoring"];

let latestReport: string | null = null;

/**
 * Stores the latest consolidated report JSON so it can be served via the
 * `inspectra://reports/latest` resource.
 */
export function setLatestReport(reportJson: string): void {
  latestReport = reportJson;
}

/**
 * Registers all MCP resources on the given server instance.
 *
 * Resources provide read-only access to Inspectra's configuration and output:
 * - `inspectra://policies/{profile}` — policy profile YAML content
 * - `inspectra://schemas/{name}` — JSON Schema definitions
 * - `inspectra://reports/latest` — most recent consolidated audit report
 */
export function registerResources(server: McpServer, policiesDir: string, schemasDir: string): void {
  // ─── Policies (dynamic template) ────────────────────────────────────────────
  server.registerResource(
    "policy-profile",
    new ResourceTemplate("inspectra://policies/{profile}", {
      list: async () => ({
        resources: AVAILABLE_PROFILES.map((p) => ({
          uri: `inspectra://policies/${p}`,
          name: `${p} profile`,
          description: `Policy profile configuration for ${p} stack`,
          mimeType: "text/yaml",
        })),
      }),
      complete: {
        profile: async () => AVAILABLE_PROFILES,
      },
    }),
    {
      description: "Read a policy profile configuration (YAML)",
      mimeType: "text/yaml",
    },
    async (uri, { profile }) => {
      const filePath = join(policiesDir, "profiles", `${profile}.yml`);
      try {
        const content = await readFile(filePath, "utf-8");
        return { contents: [{ uri: uri.href, mimeType: "text/yaml", text: content }] };
      } catch {
        return { contents: [{ uri: uri.href, mimeType: "text/plain", text: `Profile "${profile}" not found.` }] };
      }
    },
  );

  // ─── Schemas (dynamic template) ─────────────────────────────────────────────
  server.registerResource(
    "json-schema",
    new ResourceTemplate("inspectra://schemas/{name}", {
      list: async () => ({
        resources: AVAILABLE_SCHEMAS.map((s) => ({
          uri: `inspectra://schemas/${s}`,
          name: `${s} schema`,
          description: `JSON Schema for ${s}`,
          mimeType: "application/schema+json",
        })),
      }),
      complete: {
        name: async () => AVAILABLE_SCHEMAS,
      },
    }),
    {
      description: "Read a JSON Schema definition used by Inspectra",
      mimeType: "application/schema+json",
    },
    async (uri, { name }) => {
      const filePath = join(schemasDir, `${name}.schema.json`);
      try {
        const content = await readFile(filePath, "utf-8");
        return { contents: [{ uri: uri.href, mimeType: "application/schema+json", text: content }] };
      } catch {
        return { contents: [{ uri: uri.href, mimeType: "text/plain", text: `Schema "${name}" not found.` }] };
      }
    },
  );

  // ─── Latest Report (static URI) ─────────────────────────────────────────────
  server.registerResource(
    "latest-report",
    "inspectra://reports/latest",
    {
      description: "The most recent consolidated audit report. Updated after each full audit run.",
      mimeType: "application/json",
    },
    async (uri) => {
      if (!latestReport) {
        return {
          contents: [{
            uri: uri.href,
            mimeType: "text/plain",
            text: "No audit report available yet. Run a full audit first.",
          }],
        };
      }
      return { contents: [{ uri: uri.href, mimeType: "application/json", text: latestReport }] };
    },
  );
}
