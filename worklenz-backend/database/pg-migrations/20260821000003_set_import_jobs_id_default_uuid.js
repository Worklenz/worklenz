'use strict';
// Converted from database/migrations/import-tasks/20260318000000-set-import-jobs-id-default-uuid-generate-v4.sql

/** @type {import('node-pg-migrate').ColumnDefinitions | undefined} */
exports.shorthands = undefined;

/** @param {import('node-pg-migrate').MigrationBuilder} pgm */
exports.up = async (pgm) => {
  pgm.sql(`
BEGIN;

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

ALTER TABLE import_jobs
  ALTER COLUMN id SET DEFAULT uuid_generate_v4();

COMMIT;

  `);
};

/** @param {import('node-pg-migrate').MigrationBuilder} pgm */
exports.down = async (_pgm) => {
  // Review manually before running migrate:down.
};
