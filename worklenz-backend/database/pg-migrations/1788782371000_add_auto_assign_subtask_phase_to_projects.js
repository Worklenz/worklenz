/**
 * Migration: Add auto_assign_subtask_phase column to projects table
 * Date: 2026-09-07
 * Description: Add boolean column to control automatic phase assignment for subtasks.
 *              When enabled, newly created subtasks inherit their parent task's phase,
 *              and stay synced to the parent's phase going forward.
 */

/** @type {import('node-pg-migrate').ColumnDefinitions | undefined} */
exports.shorthands = undefined;

/** @param {import('node-pg-migrate').MigrationBuilder} pgm */
exports.up = async (pgm) => {
  // Raw SQL keeps this migration compatible across node-pg-migrate versions
  // and safe to re-run on databases where the column already exists.
  pgm.sql(`
    ALTER TABLE projects
      ADD COLUMN IF NOT EXISTS auto_assign_subtask_phase BOOLEAN NOT NULL DEFAULT FALSE;

    COMMENT ON COLUMN projects.auto_assign_subtask_phase IS
    'When true, newly created subtasks automatically inherit their parent task''s phase and stay synced to parent phase changes';
  `);
};

/** @param {import('node-pg-migrate').MigrationBuilder} pgm */
exports.down = async (pgm) => {
  pgm.sql(`
    ALTER TABLE projects DROP COLUMN IF EXISTS auto_assign_subtask_phase;
  `);
};
