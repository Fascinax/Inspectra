/**
 * Maximum character count for a single tool response text payload.
 *
 * Rationale: ~10k chars keeps responses under the inline threshold of hosted LLM
 * tool-call panels (e.g. VS Code Copilot MCP panel stores responses >~8KB to disk,
 * making them inaccessible to the orchestrator). 10k chars ≈ 2.5k tokens, which
 * captures the top ~12 findings per tool — enough for triage without overflowing.
 * Override via INSPECTRA_CHARACTER_LIMIT env var to raise for CLI or batch usage.
 */
export const CHARACTER_LIMIT = Number(process.env.INSPECTRA_CHARACTER_LIMIT) || 10_000;

/** MCP server name used at registration. */
export const SERVER_NAME = "inspectra";

/** Default policy profile when none is specified. */
export const DEFAULT_PROFILE = "generic";

/**
 * Default page size for findings pagination.
 *
 * Rationale: combined with CHARACTER_LIMIT, 20 findings per page keeps the
 * serialised payload under ~8KB for typical findings (each ~400 chars). Agents
 * can paginate via the `offset` parameter for larger result sets.
 * Override via INSPECTRA_DEFAULT_PAGE_SIZE env var.
 */
export const DEFAULT_PAGE_SIZE = Number(process.env.INSPECTRA_DEFAULT_PAGE_SIZE) || 20;
