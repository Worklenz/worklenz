'use strict';
// Converted from: database/migrations/20250910000001-preserve-project-logs-after-deletion.sql

/** @type {import('node-pg-migrate').ColumnDefinitions | undefined} */
exports.shorthands = undefined;

/** @param {import('node-pg-migrate').MigrationBuilder} pgm */
exports.up = async (pgm) => {
  pgm.sql(`
-- Migration: Preserve project logs after project deletion
-- This migration ensures project logs are kept for historical records even after project deletion

-- Step 1: Add project_name column to store project name for deleted projects
ALTER TABLE project_logs 
ADD COLUMN IF NOT EXISTS project_name TEXT;

-- Step 2: Update existing logs with current project names
UPDATE project_logs 
SET project_name = (SELECT name FROM projects WHERE projects.id = project_logs.project_id)
WHERE project_logs.project_name IS NULL;

-- Step 3: Drop the existing foreign key constraint
ALTER TABLE project_logs 
DROP CONSTRAINT IF EXISTS project_logs_projects_id_fk;

-- Step 4: Re-add the foreign key constraint with SET NULL on delete
ALTER TABLE project_logs
ADD CONSTRAINT IF NOT EXISTS project_logs_projects_id_fk
    FOREIGN KEY (project_id) REFERENCES projects (id)
    ON DELETE SET NULL;

-- Step 5: Create an index on project_id for performance (since it can now be NULL)
CREATE INDEX IF NOT EXISTS idx_project_logs_project_id 
ON project_logs (project_id) 
WHERE project_id IS NOT NULL;

-- Step 6: Create an index on team_id and created_at for efficient filtering
CREATE INDEX IF NOT EXISTS idx_project_logs_team_created 
ON project_logs (team_id, created_at DESC);
  `);
};

/** @param {import('node-pg-migrate').MigrationBuilder} pgm */
exports.down = async (_pgm) => {
  // This migration is a DDL/function change — no automatic rollback defined.
  // Review manually before running migrate:down.
};
