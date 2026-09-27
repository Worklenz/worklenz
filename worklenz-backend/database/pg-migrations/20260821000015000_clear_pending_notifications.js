'use strict';
// Converted from database/migrations/20260213000003-clear-pending-notifications.sql

/** @type {import('node-pg-migrate').ColumnDefinitions | undefined} */
exports.shorthands = undefined;

/** @param {import('node-pg-migrate').MigrationBuilder} pgm */
exports.up = async (pgm) => {
  pgm.sql(`
-- This legacy deployment cleanup intentionally does nothing when converted to
-- node-pg-migrate. A converted migration has a new tracking name and may run
-- against a live database whose pending notifications must be preserved.
SELECT 1;

  `);
};

/** @param {import('node-pg-migrate').MigrationBuilder} pgm */
exports.down = async (_pgm) => {
  // Review manually before running migrate:down.
};
