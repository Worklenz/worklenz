'use strict';

/**
 * Migration: Allow 'assignee' as a saved group-by preference
 * Date: 2026-09-29
 * Description: Extends the project_members task_list_group_by / board_group_by
 *              CHECK constraints so software projects can persist Assignee grouping.
 */

/** @type {import('node-pg-migrate').ColumnDefinitions | undefined} */
exports.shorthands = undefined;

/** @param {import('node-pg-migrate').MigrationBuilder} pgm */
exports.up = async (pgm) => {
  pgm.sql(`
    ALTER TABLE project_members
      DROP CONSTRAINT IF EXISTS project_members_task_list_group_by_check,
      DROP CONSTRAINT IF EXISTS project_members_board_group_by_check;

    ALTER TABLE project_members
      ADD CONSTRAINT project_members_task_list_group_by_check
        CHECK (task_list_group_by IN ('status', 'priority', 'phase', 'assignee')),
      ADD CONSTRAINT project_members_board_group_by_check
        CHECK (board_group_by IN ('status', 'priority', 'phase', 'assignee'));
  `);
};

/** @param {import('node-pg-migrate').MigrationBuilder} pgm */
exports.down = async (pgm) => {
  pgm.sql(`
    UPDATE project_members SET task_list_group_by = 'status' WHERE task_list_group_by = 'assignee';
    UPDATE project_members SET board_group_by = 'status' WHERE board_group_by = 'assignee';

    ALTER TABLE project_members
      DROP CONSTRAINT IF EXISTS project_members_task_list_group_by_check,
      DROP CONSTRAINT IF EXISTS project_members_board_group_by_check;

    ALTER TABLE project_members
      ADD CONSTRAINT project_members_task_list_group_by_check
        CHECK (task_list_group_by IN ('status', 'priority', 'phase')),
      ADD CONSTRAINT project_members_board_group_by_check
        CHECK (board_group_by IN ('status', 'priority', 'phase'));
  `);
};
