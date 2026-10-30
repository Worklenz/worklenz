'use strict';
// 1757289600000_preserve_project_logs_after_deletion switched project_logs_projects_id_fk to
// ON DELETE SET NULL but left project_id NOT NULL, so deleting any project that has logs failed
// with a not-null violation. Drop the constraint so the logs are preserved as intended.

/** @type {import('node-pg-migrate').ColumnDefinitions | undefined} */
exports.shorthands = undefined;

/** @param {import('node-pg-migrate').MigrationBuilder} pgm */
exports.up = async (pgm) => {
  pgm.sql(`ALTER TABLE project_logs ALTER COLUMN project_id DROP NOT NULL;`);
};

/** @param {import('node-pg-migrate').MigrationBuilder} _pgm */
exports.down = async (_pgm) => {
  // Not reversible: rows with a NULL project_id (deleted projects) would block SET NOT NULL.
};
