'use strict';

/**
 * Migration: Add an issue type (task, story, bug) on tasks (software projects).
 * Subtasks are identified by parent_task_id, so they keep the default type.
 * Date: 2026-09-29
 */

/** @type {import('node-pg-migrate').ColumnDefinitions | undefined} */
exports.shorthands = undefined;

/** @param {import('node-pg-migrate').MigrationBuilder} pgm */
exports.up = async (pgm) => {
  pgm.sql(`
    ALTER TABLE tasks
      ADD COLUMN IF NOT EXISTS issue_type TEXT NOT NULL DEFAULT 'task';

    ALTER TABLE tasks
      DROP CONSTRAINT IF EXISTS tasks_issue_type_check;

    ALTER TABLE tasks
      ADD CONSTRAINT tasks_issue_type_check
        CHECK (issue_type IN ('task', 'story', 'bug'));

    COMMENT ON COLUMN tasks.issue_type IS
      'Issue type for software projects: task, story or bug.';
  `);
};

/** @param {import('node-pg-migrate').MigrationBuilder} pgm */
exports.down = async (pgm) => {
  pgm.sql(`
    ALTER TABLE tasks DROP CONSTRAINT IF EXISTS tasks_issue_type_check;
    ALTER TABLE tasks DROP COLUMN IF EXISTS issue_type;
  `);
};
