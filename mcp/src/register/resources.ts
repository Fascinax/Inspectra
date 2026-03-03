import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { ResourceTemplate } from "@modelcontextprotocol/sdk/server/mcp.js";
import { readFile, readdir, writeFile, mkdir } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";

const REPORT_DIR = join(tmpdir(), "inspectra");
const REPORT_PATH = join(REPORT_DIR, "latest-report.json");

/**
 * Scans a directory for files matching a suffix and returns basenames without that suffix.
 */
async function listAvailableEntries(dir: string, suffix: string): Promise<string[]> {
  try {
    const entries = await readdir(dir);
    return entries
      .filter((f) => f.endsWith(suffix))
      .map((f) => f.slice(0, -suffix.length));
  } catch {
    return [];
  }
}

/**
 * Persists the latest consolidated report to a temp file so it survives
 * within the same machine session.
 *
 * Storage: `os.tmpdir()/inspectra/latest-report.json`
 * Limitation: not shared across machines or containers.
 */
export async function setLatestReport(reportJson: string): Promise<void> {
  await mkdir(REPORT_DIR, { recursive: true });
  await writeFile(REPORT_PATH, reportJson, "utf-8");
}

async function getLatestReport(): Promise<string | null> {
  try {
    return await readFile(REPORT_PATH, "utf-8");
  } catch {
    return null;
  }
}

/**
 * Registers all MCP resources on the given server instance.
 *
 * Resources provide read-only access to Inspectra's configuration and output:
 * - `urn:inspectra:policies:{profile}` — policy profile YAML content
 * - `urn:inspectra:schemas:{name}` — JSON Schema definitions
 * - `urn:inspectra:reports:latest` — most recent consolidated audit report
 */
export function registerResources(server: McpServer, policiesDir: string, schemasDir: string): void {
  const profilesDir = join(policiesDir, "profiles");

  // ─── Policies (dynamic template) ────────────────────────────────────────────
  server.registerResource(
    "policy-profile",
    new ResourceTemplate("urn:inspectra:policies:{profile}", {
      list: async () => {
        const profiles = await listAvailableEntries(profilesDir, ".yml");
        return {
          resources: profiles.map((p) => ({
            uri: `urn:inspectra:policies:${p}`,
            name: `${p} profile`,
            description: `Policy profile configuration for ${p} stack`,
            mimeType: "text/yaml",
          })),
        };
      },
      complete: {
        profile: async () => listAvailableEntries(profilesDir, ".yml"),
      },
    }),
    {
      description: "Read a policy profile configuration (YAML)",
      mimeType: "text/yaml",
    },
    async (uri, { profile }) => {
      const filePath = join(profilesDir, `${profile}.yml`);
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
    new ResourceTemplate("urn:inspectra:schemas:{name}", {
      list: async () => {
        const schemas = await listAvailableEntries(schemasDir, ".schema.json");
        return {
          resources: schemas.map((s) => ({
            uri: `urn:inspectra:schemas:${s}`,
            name: `${s} schema`,
            description: `JSON Schema for ${s}`,
            mimeType: "application/schema+json",
          })),
        };
      },
      complete: {
        name: async () => listAvailableEntries(schemasDir, ".schema.json"),
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
    "urn:inspectra:reports:latest",
    {
      description: "The most recent consolidated audit report. Persisted in os.tmpdir()/inspectra/. Updated after each full audit run.",
      mimeType: "application/json",
    },
    async (uri) => {
      const report = await getLatestReport();
      if (!report) {
        return {
          contents: [{
            uri: uri.href,
            mimeType: "text/plain",
            text: "No audit report available yet. Run a full audit first.",
          }],
        };
      }
      return { contents: [{ uri: uri.href, mimeType: "application/json", text: report }] };
    },
  );
}
