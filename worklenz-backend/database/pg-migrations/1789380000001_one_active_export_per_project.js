'use strict';

/** @type {import('node-pg-migrate').ColumnDefinitions | undefined} */
exports.shorthands = undefined;

/** @param {import('node-pg-migrate').MigrationBuilder} pgm */
exports.up = async (pgm) => {
  pgm.sql(`
-- Enforce one queued/processing async export per project (TOCTOU-safe with createJob).
-- Replaces the previous per-user partial index which allowed concurrent jobs
-- across users and did not prevent duplicate inserts under race.

BEGIN;

-- Keep the newest active job per project; mark older duplicates failed so the
-- unique index can be created on environments that already raced.
WITH ranked AS (
  SELECT id,
         ROW_NUMBER() OVER (
           PARTITION BY project_id
           ORDER BY created_at DESC, id DESC
         ) AS rn
  FROM task_export_jobs
  WHERE status IN ('queued', 'processing')
)
UPDATE task_export_jobs j
SET status = 'failed',
    error_message = COALESCE(
      error_message,
      'Superseded by a newer export job for this project'
    ),
    updated_at = NOW()
FROM ranked
WHERE j.id = ranked.id
  AND ranked.rn > 1;

DROP INDEX IF EXISTS idx_task_export_jobs_user_project_active;

CREATE UNIQUE INDEX IF NOT EXISTS idx_task_export_jobs_one_active_per_project
  ON task_export_jobs(project_id)
  WHERE status IN ('queued', 'processing');

COMMIT;

  `);
};

/** @param {import('node-pg-migrate').MigrationBuilder} pgm */
exports.down = async (_pgm) => {
  // Historical SQL migration: no automatic rollback is available.
};
