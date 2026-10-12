'use strict';

/**
 * Migration: Snapshot sprint scope at start and outcome at completion for Software project reports
 * Date: 2026-10-01
 */

/** @type {import('node-pg-migrate').ColumnDefinitions | undefined} */
exports.shorthands = undefined;

/** @param {import('node-pg-migrate').MigrationBuilder} pgm */
exports.up = async (pgm) => {
  pgm.sql(`
    ALTER TABLE project_phases
      ADD COLUMN IF NOT EXISTS started_at               TIMESTAMPTZ,
      ADD COLUMN IF NOT EXISTS completed_at             TIMESTAMPTZ,
      ADD COLUMN IF NOT EXISTS committed_points         DOUBLE PRECISION,
      ADD COLUMN IF NOT EXISTS committed_issue_count    INTEGER,
      ADD COLUMN IF NOT EXISTS completed_points         DOUBLE PRECISION,
      ADD COLUMN IF NOT EXISTS completed_issue_count    INTEGER,
      ADD COLUMN IF NOT EXISTS carried_over_points      DOUBLE PRECISION,
      ADD COLUMN IF NOT EXISTS carried_over_issue_count INTEGER;

    COMMENT ON COLUMN project_phases.started_at IS
      'When the sprint was started (software projects).';
    COMMENT ON COLUMN project_phases.completed_at IS
      'When the sprint was completed (software projects).';
    COMMENT ON COLUMN project_phases.committed_points IS
      'Story points in the sprint when it was started.';
    COMMENT ON COLUMN project_phases.completed_points IS
      'Done story points in the sprint when it was completed.';
    COMMENT ON COLUMN project_phases.carried_over_points IS
      'Story points of unfinished issues moved out when the sprint was completed.';
  `);
};

/** @param {import('node-pg-migrate').MigrationBuilder} pgm */
exports.down = async (pgm) => {
  pgm.sql(`
    ALTER TABLE project_phases
      DROP COLUMN IF EXISTS started_at,
      DROP COLUMN IF EXISTS completed_at,
      DROP COLUMN IF EXISTS committed_points,
      DROP COLUMN IF EXISTS committed_issue_count,
      DROP COLUMN IF EXISTS completed_points,
      DROP COLUMN IF EXISTS completed_issue_count,
      DROP COLUMN IF EXISTS carried_over_points,
      DROP COLUMN IF EXISTS carried_over_issue_count;
  `);
};
