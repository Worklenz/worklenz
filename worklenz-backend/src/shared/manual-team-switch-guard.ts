/**
 * After a manual team switch (`PUT /teams/activate`), in-flight project/task
 * requests can still hit verify-project-access / verify-task-access. Those
 * middlewares auto-activate the project's team, which silently undoes the
 * switch the user just made (common on the projects list because of hover
 * prefetches).
 *
 * Suppression is stored in Redis (shared across replicas) with an in-memory
 * fallback when Redis is unavailable. Callers must await these helpers.
 */

import { redisClient } from "../redis/client";

const DEFAULT_SUPPRESS_MS = 15_000;
const REDIS_KEY_PREFIX = "manual-team-switch-suppress:";

/** Process-local fallback when Redis is down or not yet connected. */
const suppressUntilByUserId = new Map<string, number>();

const redisKey = (userId: string) => `${REDIS_KEY_PREFIX}${userId}`;

const readMemory = (userId: string): boolean => {
  const until = suppressUntilByUserId.get(userId);
  if (until === undefined) return false;
  if (Date.now() >= until) {
    suppressUntilByUserId.delete(userId);
    return false;
  }
  return true;
};

export async function suppressAutoTeamSwitch(
  userId: string,
  durationMs: number = DEFAULT_SUPPRESS_MS
): Promise<void> {
  if (!userId) return;

  const until = Date.now() + durationMs;
  suppressUntilByUserId.set(userId, until);

  try {
    if (redisClient?.isOpen) {
      await redisClient.setEx(redisKey(userId), Math.ceil(durationMs / 1000), String(until));
    }
  } catch {
    // Memory fallback already set — keep serving this process.
  }
}

export async function isAutoTeamSwitchSuppressed(userId: string): Promise<boolean> {
  if (!userId) return false;

  try {
    if (redisClient?.isOpen) {
      const raw = await redisClient.get(redisKey(userId));
      if (raw != null) {
        const until = Number(raw);
        if (Number.isFinite(until) && Date.now() < until) {
          return true;
        }
        return false;
      }
    }
  } catch {
    // Fall through to memory.
  }

  return readMemory(userId);
}

/** Test helper — clears suppress windows in memory and Redis (best-effort). */
export async function clearAutoTeamSwitchSuppressions(): Promise<void> {
  const userIds = [...suppressUntilByUserId.keys()];
  suppressUntilByUserId.clear();

  try {
    if (redisClient?.isOpen && userIds.length > 0) {
      await redisClient.del(userIds.map(redisKey));
    }
  } catch {
    // ignore
  }
}
