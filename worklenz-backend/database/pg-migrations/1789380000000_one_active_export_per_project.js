/* eslint-disable camelcase */

// Mirrors database/migrations/task-export/20260914100000-one-active-export-per-project.sql
//
// Idempotent fix-up for environments that already ran the earlier
// 20260910100000 migration before it was corrected to create a per-project
// (rather than per-user) unique index: resolves any pre-existing races by
// keeping only the newest active job per project, then drops the old
// per-user index (if present) and (re)creates the per-project one.

exports.up = pgm => {
  pgm.sql(`
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
  `);
};

exports.down = pgm => {
  pgm.sql(`
DROP INDEX IF EXISTS idx_task_export_jobs_one_active_per_project;

CREATE INDEX IF NOT EXISTS idx_task_export_jobs_user_project_active
  ON task_export_jobs(created_by, project_id)
  WHERE status IN ('queued', 'processing');
  `);
};
