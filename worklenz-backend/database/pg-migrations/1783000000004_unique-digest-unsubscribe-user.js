/** @param {import('node-pg-migrate').MigrationBuilder} pgm */
exports.up = async (pgm) => {
  pgm.sql(`
    DELETE FROM digest_unsubscribe_tokens a
    USING digest_unsubscribe_tokens b
    WHERE a.user_id = b.user_id
      AND a.created_at < b.created_at;

    DELETE FROM digest_unsubscribe_tokens a
    USING digest_unsubscribe_tokens b
    WHERE a.user_id = b.user_id
      AND a.id < b.id;

    DROP INDEX IF EXISTS digest_unsubscribe_tokens_user_id_uidx;
    DROP INDEX IF EXISTS idx_digest_unsubscribe_token;

    ALTER TABLE digest_unsubscribe_tokens
      DROP CONSTRAINT IF EXISTS digest_unsubscribe_tokens_user_id_key;

    ALTER TABLE digest_unsubscribe_tokens
      ADD CONSTRAINT digest_unsubscribe_tokens_user_id_key UNIQUE (user_id);
  `);
};

exports.down = async (pgm) => {
  pgm.sql(`
    ALTER TABLE digest_unsubscribe_tokens
      DROP CONSTRAINT IF EXISTS digest_unsubscribe_tokens_user_id_key;
  `);
};
