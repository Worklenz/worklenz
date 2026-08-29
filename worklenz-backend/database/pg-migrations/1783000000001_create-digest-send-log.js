/** @param {import('node-pg-migrate').MigrationBuilder} pgm */
exports.up = async (pgm) => {
  pgm.sql(`
    CREATE TABLE IF NOT EXISTS digest_send_log (
      id              UUID        NOT NULL DEFAULT uuid_generate_v4() PRIMARY KEY,
      user_id         UUID        NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      email_type      TEXT        NOT NULL,
      sent_at         TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
      workspace_count INT         NOT NULL DEFAULT 0,
      section_count   INT         NOT NULL DEFAULT 0,
      skipped         BOOLEAN     NOT NULL DEFAULT FALSE,
      skip_reason     TEXT
    );

    CREATE INDEX IF NOT EXISTS idx_digest_send_log_user_type_date
      ON digest_send_log(user_id, email_type, sent_at);
  `);
};

exports.down = async (pgm) => {
  pgm.sql(`
    DROP INDEX IF EXISTS idx_digest_send_log_user_type_date;
    DROP TABLE IF EXISTS digest_send_log;
  `);
};
