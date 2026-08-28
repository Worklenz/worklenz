-- Add soft-delete support to task_comments
-- Deleted comments show a "This message was deleted" placeholder instead of disappearing.

ALTER TABLE task_comments
  ADD COLUMN IF NOT EXISTS is_deleted BOOLEAN NOT NULL DEFAULT FALSE;
