'use strict';

/** @type {import('node-pg-migrate').ColumnDefinitions | undefined} */
exports.shorthands = undefined;

/** @param {import('node-pg-migrate').MigrationBuilder} pgm */
exports.up = async (pgm) => {
  pgm.sql(`
-- Ensure import_hierarchy_mappings has position column
BEGIN;

ALTER TABLE IF EXISTS import_hierarchy_mappings
  ADD COLUMN IF NOT EXISTS position INT NOT NULL DEFAULT 0;

COMMIT;

  `);
};

/** @param {import('node-pg-migrate').MigrationBuilder} pgm */
exports.down = async (_pgm) => {
  // Historical SQL migration: no automatic rollback is available.
};
