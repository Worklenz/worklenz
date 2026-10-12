'use strict';

/** @type {import('node-pg-migrate').ColumnDefinitions | undefined} */
exports.shorthands = undefined;

/** @param {import('node-pg-migrate').MigrationBuilder} pgm */
exports.up = async (pgm) => {
  pgm.sql(`
-- Migration: Enforce NOT NULL on cpt_tasks.task_no
-- The task_no column must always have a value (sequential number per template).
-- This migration backfills any existing NULL values and then adds the NOT NULL constraint.

BEGIN;

-- Step 1: Backfill NULL task_no values using a sequential count per template
UPDATE cpt_tasks t
SET task_no = sub.rn
FROM (
    SELECT id,
           ROW_NUMBER() OVER (PARTITION BY template_id ORDER BY sort_order, created_at) AS rn
    FROM cpt_tasks
    WHERE task_no IS NULL
) sub
WHERE t.id = sub.id;

-- Step 2: Add NOT NULL constraint (safe now that all rows have a value)
ALTER TABLE cpt_tasks
    ALTER COLUMN task_no SET NOT NULL;

COMMIT;

  `);
};

/** @param {import('node-pg-migrate').MigrationBuilder} pgm */
exports.down = async (_pgm) => {
  // Historical SQL migration: no automatic rollback is available.
};
