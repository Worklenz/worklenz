'use strict';
// Audit Log CSV export jobs (Audit log spec, task 5.2).
//
// Mirrors task_export_jobs (1789034400001_create_task_export_jobs.js) - same
// queued -> processing -> ready | failed -> expired lifecycle, same storage_key +
// presigned-download pattern, same in-process polling worker (no external queue
// infra in this codebase) - just scoped to an organization instead of a project,
// and storing the applied Audit Log filters (date range, categories, actor, search)
// instead of task-export include_* options, so the worker can replay the exact
// same filtered query the user had on screen when they requested the export.

/** @param pgm {import('node-pg-migrate').MigrationBuilder} */
exports.up = (pgm) => {
  pgm.sql(`
    CREATE TABLE IF NOT EXISTS audit_log_export_jobs (
      id              UUID                     DEFAULT uuid_generate_v4() NOT NULL,
      organization_id UUID                                                NOT NULL,
      created_by      UUID                                                NOT NULL,
      status          TEXT                     DEFAULT 'queued'           NOT NULL
                           CHECK (status IN ('queued', 'processing', 'ready', 'failed', 'expired')),
      -- Applied list filters at request time: { start_date, end_date, categories[],
      -- actor_user_ids[], search } - replayed verbatim by the worker (task 5.2) so the
      -- exported CSV always matches what the user had filtered on screen.
      filters         JSONB                    DEFAULT '{}'::jsonb        NOT NULL,
      row_count       INTEGER,
      storage_key     TEXT,
      file_name       TEXT,
      size_bytes      BIGINT,
      error_message   TEXT,
      expires_at      TIMESTAMP WITH TIME ZONE,
      created_at      TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP  NOT NULL,
      updated_at      TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP  NOT NULL
    );

    ALTER TABLE audit_log_export_jobs
      ADD CONSTRAINT audit_log_export_jobs_pk PRIMARY KEY (id);

    ALTER TABLE audit_log_export_jobs
      ADD CONSTRAINT audit_log_export_jobs_organization_id_fk
        FOREIGN KEY (organization_id) REFERENCES organizations
          ON DELETE CASCADE;

    ALTER TABLE audit_log_export_jobs
      ADD CONSTRAINT audit_log_export_jobs_created_by_fk
        FOREIGN KEY (created_by) REFERENCES users
          ON DELETE SET NULL;

    -- Worker claim query (FOR UPDATE SKIP LOCKED over the oldest queued job).
    CREATE INDEX IF NOT EXISTS idx_audit_log_export_jobs_status_created
      ON audit_log_export_jobs (status, created_at ASC);

    -- "My exports" / job listing for an organization, newest first.
    CREATE INDEX IF NOT EXISTS idx_audit_log_export_jobs_org_created
      ON audit_log_export_jobs (organization_id, created_at DESC);

    -- One active (queued/processing) export per organization at a time - race-safe with
    -- createJob, same approach as idx_task_export_jobs_one_active_per_project.
    CREATE UNIQUE INDEX IF NOT EXISTS idx_audit_log_export_jobs_one_active_per_org
      ON audit_log_export_jobs (organization_id)
      WHERE status IN ('queued', 'processing');

    -- Cleanup cron: ready jobs past their retention window.
    CREATE INDEX IF NOT EXISTS idx_audit_log_export_jobs_expires
      ON audit_log_export_jobs (expires_at)
      WHERE expires_at IS NOT NULL AND status = 'ready';

    COMMENT ON TABLE audit_log_export_jobs IS
      'Async CSV export jobs for Admin Center > Security > Audit Log, used when a filtered result set exceeds the synchronous export row cap.';
    COMMENT ON COLUMN audit_log_export_jobs.filters IS
      'Snapshot of the list filters applied when the export was requested: start_date, end_date, categories[], actor_user_ids[], search.';
  `);
};

/** @param pgm {import('node-pg-migrate').MigrationBuilder} */
exports.down = (pgm) => {
  pgm.sql(`
    DROP INDEX IF EXISTS idx_audit_log_export_jobs_expires;
    DROP INDEX IF EXISTS idx_audit_log_export_jobs_one_active_per_org;
    DROP INDEX IF EXISTS idx_audit_log_export_jobs_org_created;
    DROP INDEX IF EXISTS idx_audit_log_export_jobs_status_created;

    DROP TABLE IF EXISTS audit_log_export_jobs;
  `);
};
