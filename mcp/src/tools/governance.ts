import { appendFile, mkdir } from "node:fs/promises";
import { dirname, resolve } from "node:path";

const AGENT_NAMES = [
  "audit-orchestrator",
  "audit-security",
  "audit-tests",
  "audit-architecture",
  "audit-conventions",
  "audit-performance",
  "audit-documentation",
  "audit-tech-debt",
] as const;

type AgentName = (typeof AGENT_NAMES)[number];

interface ActivityEntry {
  timestamp: string;
  agent: AgentName;
  action: string;
  tools_used: string[];
  files_touched: string[];
  outcome: "success" | "failure" | "partial";
  detail?: string;
}

function isValidAgentName(name: string): name is AgentName {
  return (AGENT_NAMES as readonly string[]).includes(name);
}

function resolveLogPath(projectDir: string): string {
  return resolve(projectDir, ".inspectra", "agent-activity.jsonl");
}

/**
 * Appends a structured activity entry to the JSONL log file.
 * Creates the `.inspectra/` directory if missing.
 */
export async function logActivity(
  projectDir: string,
  agent: string,
  action: string,
  toolsUsed: string[],
  filesTouched: string[],
  outcome: "success" | "failure" | "partial",
  detail?: string,
): Promise<{ logged: true; path: string }> {
  if (!isValidAgentName(agent)) {
    throw new Error(
      `Invalid agent name: "${agent}". Must be one of: ${AGENT_NAMES.join(", ")}`,
    );
  }

  const logPath = resolveLogPath(projectDir);
  await mkdir(dirname(logPath), { recursive: true });

  const entry: ActivityEntry = {
    timestamp: new Date().toISOString(),
    agent,
    action,
    tools_used: toolsUsed,
    files_touched: filesTouched,
    outcome,
    ...(detail ? { detail } : {}),
  };

  await appendFile(logPath, JSON.stringify(entry) + "\n", "utf-8");

  return { logged: true, path: logPath };
}

/**
 * Reads the JSONL log and returns parsed activity entries, optionally
 * filtered by agent name. Returns newest entries first.
 */
export async function readActivityLog(
  projectDir: string,
  filterAgent?: string,
  limit = 50,
): Promise<ActivityEntry[]> {
  const { readFile } = await import("node:fs/promises");
  const logPath = resolveLogPath(projectDir);

  let content: string;
  try {
    content = await readFile(logPath, "utf-8");
  } catch {
    return [];
  }

  const lines = content.trim().split("\n").filter(Boolean);
  let entries: ActivityEntry[] = lines.map((line) => JSON.parse(line) as ActivityEntry);

  if (filterAgent) {
    entries = entries.filter((e) => e.agent === filterAgent);
  }

  return entries.reverse().slice(0, limit);
}
