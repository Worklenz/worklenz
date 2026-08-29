/** @param {import('node-pg-migrate').MigrationBuilder} pgm */
exports.up = async (pgm) => {
  pgm.sql(`
    -- Add custom color_code column to task_statuses
    ALTER TABLE task_statuses
      ADD COLUMN IF NOT EXISTS color_code TEXT DEFAULT NULL;
  `);
};

exports.down = async (pgm) => {
  pgm.sql(`
    ALTER TABLE task_statuses DROP COLUMN IF EXISTS color_code;
  `);
};
