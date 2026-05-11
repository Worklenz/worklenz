-- Migration: Add priority column to projects table
-- Date: 2026-05-07

ALTER TABLE projects
    ADD COLUMN IF NOT EXISTS priority_id UUID REFERENCES task_priorities (id) ON DELETE SET NULL;

COMMENT ON COLUMN projects.priority_id IS 'Optional project-level priority (references task_priorities)';
