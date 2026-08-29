/** @param {import('node-pg-migrate').MigrationBuilder} pgm */
exports.up = async (pgm) => {
  pgm.sql(`
    CREATE TABLE IF NOT EXISTS digest_unsubscribe_tokens (
      id         UUID        NOT NULL DEFAULT uuid_generate_v4() PRIMARY KEY,
      user_id    UUID        NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      token      TEXT        NOT NULL UNIQUE,
      created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
      used_at    TIMESTAMPTZ
    );

    CREATE INDEX IF NOT EXISTS idx_digest_unsubscribe_token
      ON digest_unsubscribe_tokens(token);
  `);
};

exports.down = async (pgm) => {
  pgm.sql(`
    DROP INDEX IF EXISTS idx_digest_unsubscribe_token;
    DROP TABLE IF EXISTS digest_unsubscribe_tokens;
  `);
};
