'use strict';
// Covering index for the per-project task aggregates in the reporting projects
// query (getProjectsByTeam in controllers/reporting/reporting-controller-base.ts):
//   estimated_time -> SUM(total_minutes) over the project's tasks
//   actual_time    -> the project's task ids (task_work_log is summed per task)
//   tasks_stat     -> the project's task statuses/category counts
// Those three correlated subqueries each fetch the tasks heap once per project.
// With this index they are served by index-only scans, which removes that heap
// traffic (the tasks table is one of the largest in the schema).
// Follows the same pattern as 1778112000001_optimize_reporting_projects_grouped.js.

/** @type {import('node-pg-migrate').ColumnDefinitions | undefined} */
exports.shorthands = undefined;

/** @param {import('node-pg-migrate').MigrationBuilder} pgm */
exports.up = async (pgm) => {
  pgm.sql(`
-- Migration: Optimize reporting projects query performance
-- Date: 2026-10-12
-- Description: Add a covering index for the per-project task aggregates used by
--              the reporting projects tables (overview drawer + projects report).

CREATE INDEX IF NOT EXISTS idx_tasks_project_reporting_cover
    ON tasks (project_id) INCLUDE (id, total_minutes, archived, status_id);
  `);
};

/** @param {import('node-pg-migrate').MigrationBuilder} pgm */
exports.down = async (pgm) => {
  pgm.sql(`DROP INDEX IF EXISTS idx_tasks_project_reporting_cover;`);
};
