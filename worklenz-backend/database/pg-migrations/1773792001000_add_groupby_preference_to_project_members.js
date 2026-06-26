/**
 * Migration: Add group_by preference columns to project_members
 * Date: 2026-04-21
 * Description: Stores per-user, per-project grouping preference for the task list
 *              and board/kanban views (status | priority | phase).
 */

/** @param {import('node-pg-migrate').MigrationBuilder} pgm */
exports.up = async (pgm) => {
  pgm.sql(`
    ALTER TABLE project_members
      ADD COLUMN IF NOT EXISTS task_list_group_by TEXT NOT NULL DEFAULT 'status',
      ADD COLUMN IF NOT EXISTS board_group_by     TEXT NOT NULL DEFAULT 'status';

    ALTER TABLE project_members
      DROP CONSTRAINT IF EXISTS project_members_task_list_group_by_check,
      DROP CONSTRAINT IF EXISTS project_members_board_group_by_check;

    ALTER TABLE project_members
      ADD CONSTRAINT project_members_task_list_group_by_check
        CHECK (task_list_group_by IN ('status', 'priority', 'phase')),
      ADD CONSTRAINT project_members_board_group_by_check
        CHECK (board_group_by IN ('status', 'priority', 'phase'));

    COMMENT ON COLUMN project_members.task_list_group_by IS
      'Saved grouping preference for the task list view (status, priority, phase)';
    COMMENT ON COLUMN project_members.board_group_by IS
      'Saved grouping preference for the board/kanban view (status, priority, phase)';
  `);
};

/** @param {import('node-pg-migrate').MigrationBuilder} pgm */
exports.down = async (pgm) => {
  pgm.sql(`
    ALTER TABLE project_members
      DROP CONSTRAINT IF EXISTS project_members_task_list_group_by_check,
      DROP CONSTRAINT IF EXISTS project_members_board_group_by_check;

    ALTER TABLE project_members
      DROP COLUMN IF EXISTS task_list_group_by,
      DROP COLUMN IF EXISTS board_group_by;
  `);
};
