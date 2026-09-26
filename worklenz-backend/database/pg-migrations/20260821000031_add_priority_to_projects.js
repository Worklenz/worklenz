'use strict';
// Converted from database/migrations/20260507000000-add-priority-to-projects.sql

/** @type {import('node-pg-migrate').ColumnDefinitions | undefined} */
exports.shorthands = undefined;

/** @param {import('node-pg-migrate').MigrationBuilder} pgm */
exports.up = async (pgm) => {
  pgm.sql(`
-- Migration: Add priority column to projects table
-- Date: 2026-05-07

ALTER TABLE projects
    ADD COLUMN IF NOT EXISTS priority_id UUID REFERENCES sys_project_priorities (id) ON DELETE SET NULL;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid = 'projects'::regclass AND conname = 'projects_priority_id_fk'
  ) THEN
    ALTER TABLE projects DROP CONSTRAINT IF EXISTS projects_priority_id_fkey;
    ALTER TABLE projects
      ADD CONSTRAINT projects_priority_id_fk
      FOREIGN KEY (priority_id) REFERENCES sys_project_priorities (id) ON DELETE SET NULL;
  END IF;
END $$;

COMMENT ON COLUMN projects.priority_id IS 'Optional project-level priority (references sys_project_priorities)';

  `);
};

/** @param {import('node-pg-migrate').MigrationBuilder} pgm */
exports.down = async (_pgm) => {
  // Review manually before running migrate:down.
};
