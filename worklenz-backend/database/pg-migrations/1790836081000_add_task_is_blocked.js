'use strict';

/**
 * Migration: Add a "blocked" flag on tasks (software project issues)
 * Date: 2026-09-29
 */

/** @type {import('node-pg-migrate').ColumnDefinitions | undefined} */
exports.shorthands = undefined;

/** @param {import('node-pg-migrate').MigrationBuilder} pgm */
exports.up = async (pgm) => {
  pgm.sql(`
    ALTER TABLE tasks
      ADD COLUMN IF NOT EXISTS is_blocked BOOLEAN NOT NULL DEFAULT FALSE;

    COMMENT ON COLUMN tasks.is_blocked IS
      'TRUE when the issue is flagged as blocked (software projects).';
  `);
};

/** @param {import('node-pg-migrate').MigrationBuilder} pgm */
exports.down = async (pgm) => {
  pgm.sql(`
    ALTER TABLE tasks DROP COLUMN IF EXISTS is_blocked;
  `);
};
