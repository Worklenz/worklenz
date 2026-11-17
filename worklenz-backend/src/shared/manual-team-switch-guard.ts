/**
 * After a manual team switch (`PUT /teams/activate`), in-flight project/task
 * requests can still hit verify-project-access / verify-task-access. Those
 * middlewares auto-activate the project's team, which silently undoes the
 * switch the user just made (common on the projects list because of hover
 * prefetches).
 *
 * This process-local TTL gate blocks that auto-switch for a short window
 * after a manual activate. It must be set synchronously in the activate
 * handler before the response is sent so concurrent requests on the same
 * Node process see it even if they already loaded a stale session.
 */

const DEFAULT_SUPPRESS_MS = 15_000;

const suppressUntilByUserId = new Map<string, number>();

export function suppressAutoTeamSwitch(
  userId: string,
  durationMs: number = DEFAULT_SUPPRESS_MS
): void {
  if (!userId) return;
  suppressUntilByUserId.set(userId, Date.now() + durationMs);
}

export function isAutoTeamSwitchSuppressed(userId: string): boolean {
  if (!userId) return false;

  const until = suppressUntilByUserId.get(userId);
  if (until === undefined) return false;

  if (Date.now() >= until) {
    suppressUntilByUserId.delete(userId);
    return false;
  }

  return true;
}

/** Test helper — clears all suppress windows. */
export function clearAutoTeamSwitchSuppressions(): void {
  suppressUntilByUserId.clear();
}
