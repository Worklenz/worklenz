'use strict';

/** @type {import('node-pg-migrate').ColumnDefinitions | undefined} */
exports.shorthands = undefined;

/** @param {import('node-pg-migrate').MigrationBuilder} pgm */
exports.up = async (pgm) => {
  pgm.sql(`
-- Migration: Fix tasks_name_check constraint from 500 to 250 characters
-- Date: 2026-07-28
-- Problem: The tasks_name_check constraint was set to 500 characters max,
--          but the business requirement is 250 characters max
-- Solution: Enforce the limit on new writes without truncating legacy names.
-- node-pg-migrate owns the transaction for this migration.

-- Drop the old constraint
ALTER TABLE tasks DROP CONSTRAINT IF EXISTS tasks_name_check;

-- NOT VALID preserves existing overlong names; PostgreSQL still checks inserts
-- and updates. A legacy task must have its name shortened before it is updated.
ALTER TABLE tasks
    ADD CONSTRAINT tasks_name_check
        CHECK (CHAR_LENGTH(name) <= 250) NOT VALID;

-- Validate immediately when the existing data already satisfies the limit.
DO $$
DECLARE
    overlong_names bigint;
BEGIN
    SELECT COUNT(*) INTO overlong_names FROM tasks WHERE CHAR_LENGTH(name) > 250;
    IF overlong_names = 0 THEN
        ALTER TABLE tasks VALIDATE CONSTRAINT tasks_name_check;
    ELSE
        RAISE NOTICE 'tasks_name_check enforces new writes; % existing task names exceed 250 characters. Shorten these names before validating the constraint.', overlong_names;
    END IF;
END
$$;

  `);
};

/** @param {import('node-pg-migrate').MigrationBuilder} pgm */
exports.down = async (_pgm) => {
  // Historical SQL migration: no automatic rollback is available.
};
