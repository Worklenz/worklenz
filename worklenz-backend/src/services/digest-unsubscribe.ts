import db from "../config/db";

export type DigestUnsubscribeResult = "missing" | "invalid" | "ok";

export async function unsubscribeByToken(token?: string): Promise<DigestUnsubscribeResult> {
  if (!token) return "missing";

  const tokenRow = await db.query(
    `SELECT user_id, used_at FROM digest_unsubscribe_tokens WHERE token = $1`,
    [token]
  );

  if (!tokenRow.rows.length) return "invalid";

  const { user_id } = tokenRow.rows[0];

  await db.query(
    `UPDATE user_digest_preferences
     SET daily_enabled = FALSE,
         weekly_start_enabled = FALSE,
         weekly_end_enabled = FALSE,
         updated_at = CURRENT_TIMESTAMP
     WHERE user_id = $1`,
    [user_id]
  );

  if (!tokenRow.rows[0].used_at) {
    await db.query(
      `UPDATE digest_unsubscribe_tokens SET used_at = CURRENT_TIMESTAMP WHERE token = $1`,
      [token]
    );
  }

  return "ok";
}
