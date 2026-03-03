/**
 * Inspectra business error hierarchy.
 *
 * Every error carries a human-readable `suggestion` that tells the LLM agent
 * (or human operator) what to try next. This follows the MCP best-practice of
 * "actionable error messages" — the error alone should be enough to unblock
 * the caller without inspecting server logs.
 *
 * Design choices:
 * - Extends native `Error` so `instanceof` and stack traces work everywhere.
 * - Each subclass has a sensible default suggestion that can be overridden.
 * - The `code` field gives a machine-readable discriminant for programmatic
 *   handling (inspired by Node.js SystemError codes and Stripe error codes).
 */

export abstract class InspectraError extends Error {
  abstract readonly code: string;
  readonly suggestion: string;

  constructor(message: string, suggestion: string) {
    super(message);
    this.name = this.constructor.name;
    this.suggestion = suggestion;
  }
}

/** The provided file-system path is invalid, inaccessible, or not a directory. */
export class InvalidPathError extends InspectraError {
  readonly code = "INVALID_PATH";

  constructor(
    message: string,
    suggestion = "Check that the path is an absolute directory that exists and is readable. Avoid symlinks and shell metacharacters.",
  ) {
    super(message, suggestion);
  }
}

/** A referenced policy profile could not be loaded. */
export class ProfileNotFoundError extends InspectraError {
  readonly code = "PROFILE_NOT_FOUND";

  constructor(
    profileName: string,
    suggestion = 'Verify the profile name matches a YAML file in policies/profiles/. Available profiles: "generic", "java-backend", "angular-frontend", "java-angular-playwright".',
  ) {
    super(`Profile not found: "${profileName}"`, suggestion);
  }
}

/** JSON or YAML input could not be parsed into the expected structure. */
export class ParseError extends InspectraError {
  readonly code = "PARSE_ERROR";

  constructor(
    message: string,
    suggestion = "Ensure the input is valid JSON conforming to the expected schema. Use schemas/ as a reference.",
  ) {
    super(message, suggestion);
  }
}

/** Zod schema validation failed on tool inputs or parsed data. */
export class ValidationError extends InspectraError {
  readonly code = "VALIDATION_ERROR";

  constructor(
    message: string,
    suggestion = "Review the input against the tool's inputSchema. All required fields must be present and correctly typed.",
  ) {
    super(message, suggestion);
  }
}

/** A file expected by a tool (report, lint output, coverage file) was not found. */
export class FileNotFoundError extends InspectraError {
  readonly code = "FILE_NOT_FOUND";

  constructor(
    filePath: string,
    suggestion = "Verify the file exists at the expected path. Run the relevant build/test command first if the file is a generated artifact.",
  ) {
    super(`File not found: "${filePath}"`, suggestion);
  }
}
