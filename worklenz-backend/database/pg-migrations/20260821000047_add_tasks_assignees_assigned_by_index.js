'use strict';
// Converted from database/migrations/20260731000000-add-tasks-assignees-assigned-by-index.sql

/** @type {import('node-pg-migrate').ColumnDefinitions | undefined} */
exports.shorthands = undefined;

/** @param {import('node-pg-migrate').MigrationBuilder} pgm */
exports.up = async (pgm) => {
  pgm.sql(`
-- Index for "assigned by me" / "all" task lookups on Home > My Tasks
-- Migration: 20260731000000-add-tasks-assignees-assigned-by-index.sql
--
-- getTasksByGroupClosure() (home-page-controller.ts) filters tasks_assignees
-- by assigned_by for GROUP_BY_ASSIGN_BY_ME / GROUP_BY_ALL. Previously this
-- branch referenced a nonexistent tasks_assignees.team_id column and errored
-- on every request, so the query never actually ran. Now that it's fixed,
-- this index is needed to avoid a full table scan on tasks_assignees.

CREATE INDEX IF NOT EXISTS idx_tasks_assignees_assigned_by
ON tasks_assignees(assigned_by);

  `);
};

/** @param {import('node-pg-migrate').MigrationBuilder} pgm */
exports.down = async (_pgm) => {
  // Review manually before running migrate:down.
};
