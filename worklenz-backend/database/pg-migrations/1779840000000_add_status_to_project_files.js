'use strict';

/** @type {import('node-pg-migrate').ColumnDefinitions | undefined} */
exports.shorthands = undefined;

/** @param {import('node-pg-migrate').MigrationBuilder} pgm */
exports.up = async (pgm) => {
  pgm.sql(`
-- Add upload status to project_files to support the async presigned-URL upload flow.
--
-- 'pending' = presign issued, browser has not finished uploading yet
-- 'active'  = upload confirmed, file is visible in the UI
--
-- Existing rows (uploaded via the old synchronous path) are set to 'active'
-- so they remain fully visible with no data loss.

ALTER TABLE project_files
  ADD COLUMN IF NOT EXISTS status TEXT NOT NULL DEFAULT 'active'
    CONSTRAINT project_files_status_check CHECK (status IN ('pending', 'active'));

-- Index so the confirm endpoint can efficiently find pending records
CREATE INDEX IF NOT EXISTS idx_project_files_status
  ON project_files(status)
  WHERE status = 'pending';

-- Only active files should appear in list queries
-- Update the list query filter is handled in the controller (WHERE status = 'active').
-- No view change needed — the controller already filters by project_id.

  `);
};

/** @param {import('node-pg-migrate').MigrationBuilder} pgm */
exports.down = async (_pgm) => {
  // Historical SQL migration: no automatic rollback is available.
};
