import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { jsonResponse, withErrorHandling } from "./response.js";
import { ProjectDirField, READ_ONLY_ANNOTATIONS } from "./schemas.js";
import { logActivity, readActivityLog } from "../tools/governance.js";
import { validateProjectDir } from "../utils/paths.js";

/**
 * Registers governance and traceability MCP tools on the given server instance.
 *
 * These tools support the Stripe Minions "Traceability" principle:
 * agents log what they did, when, and with which tools.
 */
export function registerGovernanceTools(server: McpServer): void {
  server.registerTool(
    "inspectra_log_activity",
    {
      title: "Log Agent Activity",
      description: `Record an agent's activity in the append-only JSONL activity log (.inspectra/agent-activity.jsonl).

Each entry captures: which agent performed what action, which MCP tools were used, which files were touched, and the outcome.

This tool supports the Stripe Minions traceability principle: "What agent made what changes? When were changes made? Where were changes made?"

Args:
  - projectDir (string): Absolute path to the project root.
  - agent (string): Agent name (e.g. "audit-security", "audit-orchestrator").
  - action (string): Brief description of the action performed (e.g. "security audit", "merge domain reports").
  - toolsUsed (string): Comma-separated list of MCP tools invoked during the action.
  - filesTouched (string): Comma-separated list of files examined or modified.
  - outcome (string): "success", "failure", or "partial".
  - detail (string, optional): Additional context about the outcome.

Returns: Confirmation with the log file path.

Examples:
  1. Log a successful security audit:
     { "projectDir": "/app", "agent": "audit-security", "action": "security audit", "toolsUsed": "inspectra_scan_secrets,inspectra_check_deps_vulns", "filesTouched": "src/config.ts,package.json", "outcome": "success" }
  2. Log a failed audit:
     { "projectDir": "/app", "agent": "audit-tests", "action": "test quality audit", "toolsUsed": "inspectra_parse_coverage", "filesTouched": "", "outcome": "failure", "detail": "MCP server unavailable" }`,
      inputSchema: {
        projectDir: ProjectDirField,
        agent: z.string().min(1).describe("Agent name (e.g. audit-security)"),
        action: z.string().min(1).describe("Brief description of the action performed"),
        toolsUsed: z.string().describe("Comma-separated list of MCP tools invoked"),
        filesTouched: z.string().describe("Comma-separated list of files examined or modified"),
        outcome: z.enum(["success", "failure", "partial"]).describe("Action outcome"),
        detail: z.string().optional().describe("Additional context about the outcome"),
      },
      annotations: {
        readOnlyHint: false,
        destructiveHint: false,
        idempotentHint: false,
        openWorldHint: false,
      },
    },
    withErrorHandling(async ({ projectDir, agent, action, toolsUsed, filesTouched, outcome, detail }) => {
      await validateProjectDir(projectDir);
      const tools = toolsUsed.split(",").map((t) => t.trim()).filter(Boolean);
      const files = filesTouched.split(",").map((f) => f.trim()).filter(Boolean);
      const result = await logActivity(projectDir, agent, action, tools, files, outcome, detail);
      return jsonResponse(result);
    }, "inspectra_log_activity"),
  );

  server.registerTool(
    "inspectra_read_activity_log",
    {
      title: "Read Agent Activity Log",
      description: `Read the agent activity log (.inspectra/agent-activity.jsonl) for a project.

Returns the most recent activity entries, optionally filtered by agent name. Newest entries first.

Args:
  - projectDir (string): Absolute path to the project root.
  - agent (string, optional): Filter entries by agent name.
  - limit (number, optional): Maximum entries to return (default: 50).

Returns: Array of activity entries with timestamp, agent, action, tools_used, files_touched, and outcome.

Examples:
  1. Read all recent activity:
     { "projectDir": "/app" }
  2. Read only security agent activity:
     { "projectDir": "/app", "agent": "audit-security" }`,
      inputSchema: {
        projectDir: ProjectDirField,
        agent: z.string().optional().describe("Filter by agent name"),
        limit: z.number().int().positive().default(50).describe("Maximum entries to return"),
      },
      annotations: READ_ONLY_ANNOTATIONS,
    },
    withErrorHandling(async ({ projectDir, agent, limit }) => {
      await validateProjectDir(projectDir);
      const entries = await readActivityLog(projectDir, agent, limit);
      return jsonResponse({ entries, count: entries.length });
    }, "inspectra_read_activity_log"),
  );
}
