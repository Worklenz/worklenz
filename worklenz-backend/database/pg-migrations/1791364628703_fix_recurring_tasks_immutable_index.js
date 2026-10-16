'use strict';

/**
 * Forward migration to ensure the recurring tasks unique index uses the
 * immutable UTC date expression on tasks.end_date (which is TIMESTAMP WITH TIME ZONE).
 *
 * tasks.end_date is TIMESTAMPTZ (database/sql/1_tables.sql). In PostgreSQL:
 *   - Casting TIMESTAMPTZ directly to DATE (end_date::DATE) depends on the session
 *     TimeZone setting and is therefore STABLE, which causes PostgreSQL to reject
 *     it in index expressions with "functions in index expression must be marked IMMUTABLE".
 *   - Converting with AT TIME ZONE 'UTC' produces a TIMESTAMP (without time zone)
 *     at a fixed reference point, making ((end_date AT TIME ZONE 'UTC')::DATE) IMMUTABLE.
 *
 * This migration idempotently ensures idx_tasks_schedule_end_date_unique exists
 * with the correct immutable UTC expression, and restores the prior baseline
 * uniqueness constraint on tasks (schedule_id, end_date) upon rollback.
 */

/** @type {import('node-pg-migrate').ColumnDefinitions | undefined} */
exports.shorthands = undefined;

/** @param {import('node-pg-migrate').MigrationBuilder} pgm */
exports.up = async (pgm) => {
  pgm.sql(`
-- ============================================================================
-- Fix idx_tasks_schedule_end_date_unique
-- Recreate the unique index with the immutable UTC expression for TIMESTAMPTZ:
-- ((end_date AT TIME ZONE 'UTC')::DATE)
-- ============================================================================

DROP INDEX IF EXISTS idx_tasks_schedule_end_date_unique;

CREATE UNIQUE INDEX idx_tasks_schedule_end_date_unique
ON tasks (schedule_id, ((end_date AT TIME ZONE 'UTC')::DATE))
WHERE schedule_id IS NOT NULL AND end_date IS NOT NULL;
  `);
};

/** @param {import('node-pg-migrate').MigrationBuilder} pgm */
exports.down = async (pgm) => {
  pgm.sql(`
-- ============================================================================
-- Restore preceding baseline idx_tasks_schedule_end_date_unique
-- Recreate the prior unique index using the baseline raw timestamp key
-- from database/sql/1_tables.sql to maintain uniqueness on rollback.
-- ============================================================================

DROP INDEX IF EXISTS idx_tasks_schedule_end_date_unique;

CREATE UNIQUE INDEX idx_tasks_schedule_end_date_unique
ON tasks (schedule_id, end_date)
WHERE schedule_id IS NOT NULL AND end_date IS NOT NULL;
  `);
};
