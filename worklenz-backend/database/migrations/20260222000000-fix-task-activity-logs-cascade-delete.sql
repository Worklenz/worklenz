-- Migration: Fix task_activity_logs CASCADE delete to preserve user activity history
-- Date: 2026-02-22
-- 
-- Problem: When a task is deleted, all activity logs for that task are CASCADE deleted,
-- causing the user's "Last Activity" timestamp to revert to older activities instead of 
-- reflecting the most recent deletion action.
--
-- Solution: Change the foreign key constraint from ON DELETE CASCADE to ON DELETE SET NULL,
-- preserving activity logs even after task deletion.

-- First, make sure task_id column allows NULL values
ALTER TABLE task_activity_logs 
  ALTER COLUMN task_id DROP NOT NULL;

-- Drop the existing foreign key constraint
ALTER TABLE task_activity_logs 
  DROP CONSTRAINT IF EXISTS task_activity_logs_tasks_id_fk;

-- Recreate the constraint with ON DELETE SET NULL instead of CASCADE
ALTER TABLE task_activity_logs 
  ADD CONSTRAINT task_activity_logs_tasks_id_fk 
    FOREIGN KEY (task_id) REFERENCES tasks(id) 
    ON DELETE SET NULL;

-- Add a comment explaining the behavior
COMMENT ON CONSTRAINT task_activity_logs_tasks_id_fk ON task_activity_logs IS 
  'Foreign key to tasks table. ON DELETE SET NULL preserves activity logs for deleted tasks, maintaining accurate user activity history.';

-- Add an index on task_id for performance (NULL values will be included)
CREATE INDEX IF NOT EXISTS idx_task_activity_logs_task_id 
  ON task_activity_logs(task_id) 
  WHERE task_id IS NOT NULL;

-- Create an index for NULL task_ids (deleted tasks) to help with analytics
CREATE INDEX IF NOT EXISTS idx_task_activity_logs_deleted_task 
  ON task_activity_logs(created_at DESC) 
  WHERE task_id IS NULL;
