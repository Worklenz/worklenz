'use strict';

/**
 * Migration: Software projects can opt in to starting and completing sprints
 * automatically on their start / end dates (see cron_jobs/sprint-auto-schedule-job).
 * Date: 2026-10-12
 */

/** @type {import('node-pg-migrate').ColumnDefinitions | undefined} */
exports.shorthands = undefined;

/** @param {import('node-pg-migrate').MigrationBuilder} pgm */
exports.up = async (pgm) => {
  pgm.sql(`
    ALTER TABLE projects
      ADD COLUMN IF NOT EXISTS auto_start_complete_sprints BOOLEAN NOT NULL DEFAULT FALSE;

    COMMENT ON COLUMN projects.auto_start_complete_sprints IS
      'Software projects: start planned sprints on their start date and complete active sprints after their end date.';
  `);
};

/** @param {import('node-pg-migrate').MigrationBuilder} pgm */
exports.down = async (pgm) => {
  pgm.sql(`
    ALTER TABLE projects DROP COLUMN IF EXISTS auto_start_complete_sprints;
  `);
};
