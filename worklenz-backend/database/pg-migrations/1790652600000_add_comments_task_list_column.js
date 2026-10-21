'use strict';
// Adds the COMMENTS key to the task-list column enum so the "Latest Comment"
// column can be persisted as a field preference. Run in its own migration:
// PostgreSQL cannot use a new enum value in the same transaction that adds it.

/** @type {import('node-pg-migrate').MigrationBuilder} pgm */
exports.up = async (pgm) => {
  pgm.sql(`
    ALTER TYPE WL_TASK_LIST_COL_KEY
    ADD VALUE IF NOT EXISTS 'COMMENTS';
  `);
};

/** @type {import('node-pg-migrate').MigrationBuilder} pgm */
exports.down = async () => {
  // PostgreSQL enum values cannot be removed safely after they are committed.
};
