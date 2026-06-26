'use strict';
// Converted from: database/migrations/20251216000000-optimize-subtask-filtering.sql

/** @type {import('node-pg-migrate').ColumnDefinitions | undefined} */
exports.shorthands = undefined;

/** @param {import('node-pg-migrate').MigrationBuilder} pgm */
exports.up = async (pgm) => {
  pgm.sql(`
-- Migration: Optimize subtask filtering performance
-- Date: 2025-01-01
-- Description: Add indexes to improve performance when filtering tasks by subtask attributes

-- Add index for parent_task_id lookups (if not exists)
CREATE INDEX IF NOT EXISTS idx_tasks_parent_task_id 
ON tasks(parent_task_id) 
WHERE parent_task_id IS NOT NULL;

-- Add composite index for parent_task_id and archived status
CREATE INDEX IF NOT EXISTS idx_tasks_parent_archived 
ON tasks(parent_task_id, archived) 
WHERE parent_task_id IS NOT NULL;

-- Add index for tasks_assignees team_member_id (if not exists)
CREATE INDEX IF NOT EXISTS idx_tasks_assignees_team_member 
ON tasks_assignees(team_member_id);

-- Add composite index for tasks_assignees with task_id
CREATE INDEX IF NOT EXISTS idx_tasks_assignees_task_member 
ON tasks_assignees(task_id, team_member_id);

-- Add index for task_labels label_id (if not exists)
CREATE INDEX IF NOT EXISTS idx_task_labels_label_id 
ON task_labels(label_id);

-- Add composite index for task_labels with task_id
CREATE INDEX IF NOT EXISTS idx_task_labels_task_label 
ON task_labels(task_id, label_id);

-- Add index for priority_id on tasks
CREATE INDEX IF NOT EXISTS idx_tasks_priority_id 
ON tasks(priority_id) 
WHERE priority_id IS NOT NULL;

-- Add composite index for parent_task_id and priority_id
CREATE INDEX IF NOT EXISTS idx_tasks_parent_priority 
ON tasks(parent_task_id, priority_id) 
WHERE parent_task_id IS NOT NULL;

-- Add comments for documentation
COMMENT ON INDEX idx_tasks_parent_task_id IS 'Improves performance for subtask lookups when filtering';
COMMENT ON INDEX idx_tasks_parent_archived IS 'Optimizes subtask filtering with archived status check';
COMMENT ON INDEX idx_tasks_assignees_team_member IS 'Speeds up member-based task filtering';
COMMENT ON INDEX idx_tasks_assignees_task_member IS 'Optimizes subtask assignee lookups';
COMMENT ON INDEX idx_task_labels_label_id IS 'Speeds up label-based task filtering';
COMMENT ON INDEX idx_task_labels_task_label IS 'Optimizes subtask label lookups';
COMMENT ON INDEX idx_tasks_priority_id IS 'Speeds up priority-based task filtering';
COMMENT ON INDEX idx_tasks_parent_priority IS 'Optimizes subtask priority lookups';

  `);
};

/** @param {import('node-pg-migrate').MigrationBuilder} pgm */
exports.down = async (_pgm) => {
  // This migration is a DDL/function change — no automatic rollback defined.
  // Review manually before running migrate:down.
};
