/**
 * Maximum character count for a single tool response text payload.
 *
 * Rationale: 100k chars ≈ 25k tokens, which fits comfortably within the context
 * window of most LLMs (Claude ~200k tokens, GPT-4 ~128k tokens) while leaving
 * room for the LLM's own reasoning. Override via INSPECTRA_CHARACTER_LIMIT env var.
 */
export const CHARACTER_LIMIT = Number(process.env.INSPECTRA_CHARACTER_LIMIT) || 100_000;

/** MCP server name used at registration. */
export const SERVER_NAME = "inspectra";

/** Default policy profile when none is specified. */
export const DEFAULT_PROFILE = "generic";

/**
 * Default page size for findings pagination.
 *
 * Rationale: a typical audit produces 10–30 findings per domain. A limit of 50
 * captures most single-domain results in one page while keeping response size
 * manageable. Override via INSPECTRA_DEFAULT_PAGE_SIZE env var.
 */
export const DEFAULT_PAGE_SIZE = Number(process.env.INSPECTRA_DEFAULT_PAGE_SIZE) || 50;
