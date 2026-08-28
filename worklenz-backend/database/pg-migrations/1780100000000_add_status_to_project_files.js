/* eslint-disable camelcase */

// Adds the `status` column to project_files to support the async
// presigned-URL upload flow.
//
//   'pending' = presign issued, browser has not finished uploading yet
//   'active'  = upload confirmed, file is visible in the UI
//
// Existing rows (uploaded via the old synchronous path) default to 'active'
// so they remain fully visible with no data loss.
//
// Mirrors database/migrations/20260527000000-add-status-to-project-files.sql
// so the migration runs automatically through the pg-migrations runner.

exports.up = pgm => {
  pgm.sql(`
    ALTER TABLE project_files
      ADD COLUMN IF NOT EXISTS status TEXT NOT NULL DEFAULT 'active';

    DO $$
    BEGIN
      IF NOT EXISTS (
        SELECT 1
        FROM pg_constraint
        WHERE conrelid = 'project_files'::regclass
          AND conname = 'project_files_status_check'
      ) THEN
        ALTER TABLE project_files
          ADD CONSTRAINT project_files_status_check
          CHECK (status IN ('pending', 'active'));
      END IF;
    END $$;

    -- Partial index so the confirm endpoint and cleanup job can efficiently
    -- find pending records.
    CREATE INDEX IF NOT EXISTS idx_project_files_status
      ON project_files(status)
      WHERE status = 'pending';
  `);
};

exports.down = pgm => {
  pgm.sql(`
    DROP INDEX IF EXISTS idx_project_files_status;
    ALTER TABLE project_files DROP CONSTRAINT IF EXISTS project_files_status_check;
    ALTER TABLE project_files DROP COLUMN IF EXISTS status;
  `);
};
