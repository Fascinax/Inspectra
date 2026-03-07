/**
 * Creates a stateful ID generator for a given domain prefix.
 *
 * @param prefix - Domain prefix, e.g. `"SEC"`, `"TST"`, `"ARC"`, `"CNV"`.
 * @param start - Counter start value. Defaults to 1.
 * @returns A function that returns the next formatted ID on every invocation
 *          (`PREFIX-001`, `PREFIX-002`, …).
 *
 * @example
 * const nextId = createIdSequence("SEC", 100);
 * nextId(); // "SEC-100"
 * nextId(); // "SEC-101"
 */
export function createIdSequence(prefix: string, start = 1): () => string {
  let counter = start;
  return () => `${prefix}-${String(counter++).padStart(3, "0")}`;
}

/** Convenience alias for the closure returned by {@link createIdSequence}. */
export type IdGenerator = () => string;
