/**
 * Lightweight stderr-only logger for the Inspectra MCP server.
 *
 * Design choices:
 * - **stderr only**: stdio transport reserves stdout for JSON-RPC. Any stdout
 *   output breaks the MCP protocol. This logger writes exclusively to stderr
 *   via console.error, following the MCP best-practice: "stdio servers should
 *   NOT log to stdout (use stderr for logging)".
 * - **Zero dependencies**: No winston/pino — the server's logging needs are
 *   simple (tool invocations, errors, startup). A lightweight wrapper avoids
 *   adding transitive deps that bloat the server.
 * - **Structured format**: `[ISO-timestamp] [LEVEL] message` for easy grep/tail.
 * - **Configurable level**: INSPECTRA_LOG_LEVEL env var (debug|info|warn|error).
 *   Default: "info" — captures tool invocations and errors without noise.
 */

/* eslint-disable no-console */

const LOG_LEVELS = { debug: 0, info: 1, warn: 2, error: 3 } as const;
type LogLevel = keyof typeof LOG_LEVELS;

function resolveLevel(): LogLevel {
  const raw = (process.env.INSPECTRA_LOG_LEVEL ?? "info").toLowerCase();
  return raw in LOG_LEVELS ? (raw as LogLevel) : "info";
}

let currentLevel: LogLevel = resolveLevel();

function shouldLog(level: LogLevel): boolean {
  return LOG_LEVELS[level] >= LOG_LEVELS[currentLevel];
}

function formatMessage(level: LogLevel, message: string, context?: Record<string, unknown>): string {
  const ts = new Date().toISOString();
  const tag = level.toUpperCase().padEnd(5);
  const base = `[${ts}] [${tag}] ${message}`;
  if (context && Object.keys(context).length > 0) {
    return `${base} ${JSON.stringify(context)}`;
  }
  return base;
}

export const logger = {
  debug(message: string, context?: Record<string, unknown>): void {
    if (shouldLog("debug")) console.error(formatMessage("debug", message, context));
  },

  info(message: string, context?: Record<string, unknown>): void {
    if (shouldLog("info")) console.error(formatMessage("info", message, context));
  },

  warn(message: string, context?: Record<string, unknown>): void {
    if (shouldLog("warn")) console.error(formatMessage("warn", message, context));
  },

  error(message: string, context?: Record<string, unknown>): void {
    if (shouldLog("error")) console.error(formatMessage("error", message, context));
  },

  /** Reloads the log level from INSPECTRA_LOG_LEVEL env var. Useful for tests. */
  reload(): void {
    currentLevel = resolveLevel();
  },

  /** Returns the current effective log level. */
  getLevel(): LogLevel {
    return currentLevel;
  },
};
