import db from "../config/db";

const LOCK_WAIT_MS = 5000;
const RETRY_DELAY_MS = 50;

/** Serialize a team's seat checks. Contending requests release their pool connection before retrying. */
export async function withTeamSeatLock<T>(
  teamId: string,
  fn: () => Promise<T>,
): Promise<T> {
  const deadline = Date.now() + LOCK_WAIT_MS;
  const key = `team-seats:${teamId}`;
  while (true) {
    const client = await db.pool.connect();
    let acquired = false;
    let discardConnection = false;
    try {
      const result = await client.query(
        "SELECT pg_try_advisory_lock(hashtext($1)) AS acquired;",
        [key],
      );
      acquired = result.rows[0]?.acquired === true;
      if (acquired) return await fn();
    } finally {
      try {
        if (acquired)
          await client.query("SELECT pg_advisory_unlock(hashtext($1));", [key]);
      } catch (error) {
        discardConnection = true;
        throw error;
      } finally {
        client.release(discardConnection);
      }
    }
    if (Date.now() >= deadline)
      throw new Error(
        "Timed out waiting for the team seat lock. Please try again.",
      );
    await new Promise((resolve) => setTimeout(resolve, RETRY_DELAY_MS));
  }
}
