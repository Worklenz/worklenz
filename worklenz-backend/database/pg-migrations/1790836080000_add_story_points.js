'use strict';

/**
 * Migration: Add a per-project story point scale and story points on tasks (software projects)
 * Date: 2026-09-29
 */

/** @type {import('node-pg-migrate').ColumnDefinitions | undefined} */
exports.shorthands = undefined;

/** @param {import('node-pg-migrate').MigrationBuilder} pgm */
exports.up = async (pgm) => {
  pgm.sql(`
    ALTER TABLE projects
      ADD COLUMN IF NOT EXISTS story_point_scale DOUBLE PRECISION[] NOT NULL
        DEFAULT ARRAY[0, 1, 2, 3, 5, 8, 13, 21]::DOUBLE PRECISION[];

    ALTER TABLE projects
      DROP CONSTRAINT IF EXISTS projects_story_point_scale_check;

    ALTER TABLE projects
      ADD CONSTRAINT projects_story_point_scale_check
        CHECK (
          COALESCE(ARRAY_LENGTH(story_point_scale, 1), 0) BETWEEN 1 AND 30
          AND 0 <= ALL (story_point_scale)
          AND 1000 >= ALL (story_point_scale)
        );

    ALTER TABLE tasks
      ADD COLUMN IF NOT EXISTS story_points DOUBLE PRECISION;

    ALTER TABLE tasks
      DROP CONSTRAINT IF EXISTS tasks_story_points_range_check;

    ALTER TABLE tasks
      ADD CONSTRAINT tasks_story_points_range_check
        CHECK (story_points IS NULL OR (story_points >= 0 AND story_points <= 1000));

    COMMENT ON COLUMN projects.story_point_scale IS
      'Allowed story point values offered when estimating issues (software projects).';
    COMMENT ON COLUMN tasks.story_points IS
      'Story point estimate of the task. NULL when not estimated.';
  `);
};

/** @param {import('node-pg-migrate').MigrationBuilder} pgm */
exports.down = async (pgm) => {
  pgm.sql(`
    ALTER TABLE tasks DROP CONSTRAINT IF EXISTS tasks_story_points_range_check;
    ALTER TABLE tasks DROP COLUMN IF EXISTS story_points;
    ALTER TABLE projects DROP CONSTRAINT IF EXISTS projects_story_point_scale_check;
    ALTER TABLE projects DROP COLUMN IF EXISTS story_point_scale;
  `);
};
