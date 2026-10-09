'use strict';

/**
 * Forward-fix migration for issues originally introduced by:
 *   - 1769558401000_fix_recurring_tasks
 *   - 1770681600000_recurring_tasks_complete_fix
 *
 * Those historical migrations contained:
 *   1. An index expression using AT TIME ZONE 'UTC' which is STABLE, not
 *      IMMUTABLE — PostgreSQL rejects non-IMMUTABLE functions in index
 *      expressions.  On databases where the migration succeeded (e.g. via a
 *      patched local run) the index may already exist with a plain cast; on
 *      databases where it failed the index will be absent.
 *   2. Explicit BEGIN / COMMIT inside pgm.sql() which conflicts with
 *      node-pg-migrate's own transaction wrapping.  This is a migration-time
 *      issue only and leaves no residual schema problem, so no runtime fix is
 *      needed.
 *
 * This migration idempotently ensures the correct unique index exists
 * regardless of which state the database is in.
 */

/** @type {import('node-pg-migrate').ColumnDefinitions | undefined} */
exports.shorthands = undefined;

/** @param {import('node-pg-migrate').MigrationBuilder} pgm */
exports.up = async (pgm) => {
  pgm.sql(`
-- ============================================================================
-- Fix idx_tasks_schedule_end_date_unique
-- Drop the old index (may have been created with AT TIME ZONE 'UTC' or may
-- not exist at all) and recreate it with an IMMUTABLE expression.
-- ============================================================================

DROP INDEX IF EXISTS idx_tasks_schedule_end_date_unique;

CREATE UNIQUE INDEX idx_tasks_schedule_end_date_unique
ON tasks (schedule_id, (end_date::DATE))
WHERE schedule_id IS NOT NULL AND end_date IS NOT NULL;
  `);
};

/** @param {import('node-pg-migrate').MigrationBuilder} pgm */
exports.down = async (pgm) => {
  pgm.sql(`
-- Revert to the original (non-IMMUTABLE) form is not safe — just drop it.
DROP INDEX IF EXISTS idx_tasks_schedule_end_date_unique;
  `);
};
