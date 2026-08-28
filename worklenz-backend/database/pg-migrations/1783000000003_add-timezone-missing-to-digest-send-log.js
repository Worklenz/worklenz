/** @param {import('node-pg-migrate').MigrationBuilder} pgm */
exports.up = async (pgm) => {
  pgm.sql(`
    ALTER TABLE digest_send_log
      ADD COLUMN IF NOT EXISTS timezone_missing BOOLEAN NOT NULL DEFAULT FALSE;
  `);
};

exports.down = async (pgm) => {
  pgm.sql(`
    ALTER TABLE digest_send_log
      DROP COLUMN IF EXISTS timezone_missing;
  `);
};
