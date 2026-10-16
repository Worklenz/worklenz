/** Splits a comma-separated query value (`a,b,c`) into its non-empty, trimmed items. */
export const splitList = (value?: string): string[] =>
  (value ?? "")
    .split(",")
    .map(item => item.trim())
    .filter(Boolean);

/**
 * A contains-match pattern for ILIKE from user-typed search text. `%`, `_` and the escape character itself
 * are escaped, so searching for "50%" or "a_b" matches those characters instead of acting as wildcards.
 */
export const containsPattern = (value: string): string => `%${value.replace(/[\%_]/g, "\$&")}%`;
