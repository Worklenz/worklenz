'use strict';

/**
 * Migration: Add sprint_goal to project_phases for Software project sprints
 * Date: 2026-09-29
 */

/** @type {import('node-pg-migrate').ColumnDefinitions | undefined} */
exports.shorthands = undefined;

/** @param {import('node-pg-migrate').MigrationBuilder} pgm */
exports.up = async (pgm) => {
  pgm.sql(`
    ALTER TABLE project_phases
      ADD COLUMN IF NOT EXISTS sprint_goal TEXT;

    ALTER TABLE project_phases
      DROP CONSTRAINT IF EXISTS project_phases_sprint_goal_length_check;

    ALTER TABLE project_phases
      ADD CONSTRAINT project_phases_sprint_goal_length_check
        CHECK (sprint_goal IS NULL OR CHAR_LENGTH(sprint_goal) <= 500);

    COMMENT ON COLUMN project_phases.sprint_goal IS
      'Outcome the sprint should achieve (software projects). Max 500 characters.';
  `);
};

/** @param {import('node-pg-migrate').MigrationBuilder} pgm */
exports.down = async (pgm) => {
  pgm.sql(`
    ALTER TABLE project_phases
      DROP CONSTRAINT IF EXISTS project_phases_sprint_goal_length_check;
    ALTER TABLE project_phases
      DROP COLUMN IF EXISTS sprint_goal;
  `);
};
