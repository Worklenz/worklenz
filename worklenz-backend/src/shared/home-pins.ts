// Personal task pinning on Home > Today's Priorities (#2372). Kept free of any `db` import so the
// rules can be unit tested without a Postgres client.

/** Most tasks one user can have pinned at once. Hard limit: pinning past it is refused, nothing is evicted. */
export const HOME_PIN_LIMIT = 25;

export const PIN_LIMIT_REACHED_CODE = "PIN_LIMIT_REACHED";

/** Body returned (with HTTP 409) when a pin would exceed the limit, so the client can show its own message. */
export function buildPinLimitReachedBody(): { code: string; limit: number } {
  return { code: PIN_LIMIT_REACHED_CODE, limit: HOME_PIN_LIMIT };
}

/** True when the user already has as many visible pins as the limit allows. */
export function isPinLimitReached(visiblePinCount: number): boolean {
  return visiblePinCount >= HOME_PIN_LIMIT;
}
