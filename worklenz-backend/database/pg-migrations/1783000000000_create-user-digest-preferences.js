/** @param {import('node-pg-migrate').MigrationBuilder} pgm */
exports.up = async (pgm) => {
  pgm.sql(`
    CREATE TABLE IF NOT EXISTS user_digest_preferences (
      user_id                UUID    NOT NULL PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
      daily_enabled          BOOLEAN NOT NULL DEFAULT FALSE,
      daily_send_time        TIME    NOT NULL DEFAULT '09:00',
      weekly_start_enabled   BOOLEAN NOT NULL DEFAULT FALSE,
      weekly_start_send_time TIME    NOT NULL DEFAULT '08:00',
      weekly_end_enabled     BOOLEAN NOT NULL DEFAULT FALSE,
      weekly_end_send_time   TIME    NOT NULL DEFAULT '16:00',
      created_at             TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at             TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
    );
  `);
};

exports.down = async (pgm) => {
  pgm.sql(`DROP TABLE IF EXISTS user_digest_preferences;`);
};
