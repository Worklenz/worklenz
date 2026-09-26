'use strict';
// Converted from database/migrations/20260728000002-fix-task-name-constraint-to-250-chars.sql

/** @type {import('node-pg-migrate').ColumnDefinitions | undefined} */
exports.shorthands = undefined;

/** @param {import('node-pg-migrate').MigrationBuilder} pgm */
exports.up = async (pgm) => {
  pgm.sql(`
-- Migration: Fix tasks_name_check constraint from 500 to 250 characters
-- Date: 2026-07-28
-- Problem: The tasks_name_check constraint was set to 500 characters max,
--          but the business requirement is 250 characters max
-- Solution: Drop the old constraint and create a new one with 250 character limit

-- Drop the old constraint
ALTER TABLE tasks DROP CONSTRAINT IF EXISTS tasks_name_check;

-- Ensure existing task names comply with 250 char limit before adding constraint
UPDATE tasks SET name = SUBSTRING(name, 1, 250) WHERE CHAR_LENGTH(name) > 250;

-- Create new constraint with 250 character limit
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'tasks_name_check' AND conrelid = 'tasks'::regclass) THEN
    ALTER TABLE tasks ADD CONSTRAINT tasks_name_check CHECK (CHAR_LENGTH(name) <= 250);
  END IF;
END $$;

  `);
};

/** @param {import('node-pg-migrate').MigrationBuilder} pgm */
exports.down = async (_pgm) => {
  // Review manually before running migrate:down.
};
