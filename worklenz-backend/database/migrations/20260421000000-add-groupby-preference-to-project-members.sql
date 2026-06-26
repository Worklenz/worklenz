-- Migration: Add group_by preference columns to project_members
-- Description: Store per-user, per-project grouping preference for task list and board views
-- Date: 2026-04-21

ALTER TABLE project_members
  ADD COLUMN IF NOT EXISTS task_list_group_by TEXT DEFAULT 'status' NOT NULL,
  ADD COLUMN IF NOT EXISTS board_group_by TEXT DEFAULT 'status' NOT NULL;

ALTER TABLE project_members
  ADD CONSTRAINT project_members_task_list_group_by_check
    CHECK (task_list_group_by IN ('status', 'priority', 'phase'));

ALTER TABLE project_members
  ADD CONSTRAINT project_members_board_group_by_check
    CHECK (board_group_by IN ('status', 'priority', 'phase'));

COMMENT ON COLUMN project_members.task_list_group_by IS 'Saved grouping preference for the task list view (status, priority, phase)';
COMMENT ON COLUMN project_members.board_group_by IS 'Saved grouping preference for the board/kanban view (status, priority, phase)';
