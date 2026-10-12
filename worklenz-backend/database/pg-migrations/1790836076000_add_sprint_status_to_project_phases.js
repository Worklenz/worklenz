'use strict';

/**
 * Migration: Add sprint_status to project_phases for Software projects
 * Date: 2026-09-25
 */

/** @type {import('node-pg-migrate').ColumnDefinitions | undefined} */
exports.shorthands = undefined;

/** @param {import('node-pg-migrate').MigrationBuilder} pgm */
exports.up = async (pgm) => {
  pgm.sql(`
    ALTER TABLE project_phases
      ADD COLUMN IF NOT EXISTS sprint_status TEXT NOT NULL DEFAULT 'planned';

    ALTER TABLE project_phases
      DROP CONSTRAINT IF EXISTS project_phases_sprint_status_check;

    ALTER TABLE project_phases
      ADD CONSTRAINT project_phases_sprint_status_check
        CHECK (sprint_status IN ('planned', 'active', 'completed'));

    COMMENT ON COLUMN project_phases.sprint_status IS
      'Sprint lifecycle for software projects: planned | active | completed. Unused conceptually for general projects (stays planned).';

    CREATE UNIQUE INDEX IF NOT EXISTS project_phases_one_active_sprint_uindex
      ON project_phases (project_id)
      WHERE sprint_status = 'active';
  `);
};

/** @param {import('node-pg-migrate').MigrationBuilder} pgm */
exports.down = async (pgm) => {
  pgm.sql(`
    DROP INDEX IF EXISTS project_phases_one_active_sprint_uindex;
    ALTER TABLE project_phases
      DROP CONSTRAINT IF EXISTS project_phases_sprint_status_check;
    ALTER TABLE project_phases
      DROP COLUMN IF EXISTS sprint_status;
  `);
};
