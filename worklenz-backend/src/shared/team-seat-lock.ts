import db from "../config/db";

/**
 * Runs `fn` while holding a per-team advisory lock. Seat checks read the member count and the
 * invite inserts the member afterwards; without the lock two concurrent invites both see a free
 * seat and the team ends up one over its purchased seats.
 *
 * The lock is session-level on a dedicated connection, so it is released even if `fn` throws.
 */
export async function withTeamSeatLock<T>(teamId: string, fn: () => Promise<T>): Promise<T> {
  const client = await db.pool.connect();
  const key = `team-seats:${teamId}`;
  try {
    await client.query("SELECT pg_advisory_lock(hashtext($1));", [key]);
    try {
      return await fn();
    } finally {
      await client.query("SELECT pg_advisory_unlock(hashtext($1));", [key]);
    }
  } finally {
    client.release();
  }
}
