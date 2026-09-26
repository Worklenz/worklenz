'use strict';

/**  {import('node-pg-migrate').MigrationBuilder} pgm */
exports.up = async (pgm) => {
  // PostgreSQL makes a newly added enum value usable only after commit.
  pgm.noTransaction();
  pgm.sql(`
ALTER TYPE WL_TASK_LIST_COL_KEY ADD VALUE IF NOT EXISTS 'DUE_TIME' AFTER 'DUE_DATE';
  `);
};

/**  {import('node-pg-migrate').MigrationBuilder} pgm */
exports.down = async (_pgm) => {
  // Enum values cannot be removed safely.
};
