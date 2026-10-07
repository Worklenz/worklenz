/* eslint-disable camelcase */

// Mirrors database/migrations/task-export/20260910100000-create-task-export-jobs.sql

exports.up = pgm => {
  pgm.sql(`
CREATE TABLE IF NOT EXISTS task_export_jobs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  team_id UUID NOT NULL REFERENCES teams(id) ON DELETE CASCADE,
  project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  created_by UUID NOT NULL REFERENCES users(id),
  status TEXT NOT NULL DEFAULT 'queued'
    CHECK (status IN ('queued', 'processing', 'ready', 'failed', 'expired')),
  options JSONB NOT NULL DEFAULT '{}'::jsonb,
  stats JSONB NOT NULL DEFAULT '{}'::jsonb,
  storage_key TEXT NULL,
  file_name TEXT NULL,
  content_type TEXT NULL,
  size_bytes BIGINT NULL,
  error_message TEXT NULL,
  expires_at TIMESTAMPTZ NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_task_export_jobs_status_created
  ON task_export_jobs(status, created_at ASC);

CREATE INDEX IF NOT EXISTS idx_task_export_jobs_project_created
  ON task_export_jobs(project_id, created_at DESC);

CREATE UNIQUE INDEX IF NOT EXISTS idx_task_export_jobs_one_active_per_project
  ON task_export_jobs(project_id)
  WHERE status IN ('queued', 'processing');

CREATE INDEX IF NOT EXISTS idx_task_export_jobs_expires
  ON task_export_jobs(expires_at)
  WHERE expires_at IS NOT NULL AND status = 'ready';

CREATE TABLE IF NOT EXISTS task_export_audit_logs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  job_id UUID NULL REFERENCES task_export_jobs(id) ON DELETE SET NULL,
  team_id UUID NOT NULL,
  project_id UUID NOT NULL,
  actor_id UUID NOT NULL,
  action TEXT NOT NULL,
  message TEXT NOT NULL,
  context JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_task_export_audit_job
  ON task_export_audit_logs(job_id);

CREATE INDEX IF NOT EXISTS idx_task_export_audit_project
  ON task_export_audit_logs(project_id, created_at DESC);
  `);
};

exports.down = pgm => {
  pgm.sql(`
DROP INDEX IF EXISTS idx_task_export_audit_project;
DROP INDEX IF EXISTS idx_task_export_audit_job;
DROP TABLE IF EXISTS task_export_audit_logs;
DROP INDEX IF EXISTS idx_task_export_jobs_expires;
DROP INDEX IF EXISTS idx_task_export_jobs_one_active_per_project;
DROP INDEX IF EXISTS idx_task_export_jobs_project_created;
DROP INDEX IF EXISTS idx_task_export_jobs_status_created;
DROP TABLE IF EXISTS task_export_jobs;
  `);
};
