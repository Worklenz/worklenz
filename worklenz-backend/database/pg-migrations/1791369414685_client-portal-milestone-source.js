'use strict';
// Client Portal v2: where a project's milestones come from.
//
// 'worklenz' shows the WorkLenz project's own phases (read-only, with their real dates);
// 'manual' shows the milestones staff add in the portal. Existing projects keep 'manual', so what
// clients see today does not change until staff switch a project over.

/** @type {import('node-pg-migrate').MigrationBuilder} pgm */
exports.up = async (pgm) => {
  pgm.sql(`
    ALTER TABLE project_client_settings
      ADD COLUMN IF NOT EXISTS milestone_source TEXT NOT NULL DEFAULT 'manual';

    ALTER TABLE project_client_settings
      DROP CONSTRAINT IF EXISTS project_client_settings_milestone_source_check;
    ALTER TABLE project_client_settings
      ADD CONSTRAINT project_client_settings_milestone_source_check
      CHECK (milestone_source IN ('worklenz', 'manual'));
  `);
};

/** @type {import('node-pg-migrate').MigrationBuilder} pgm */
exports.down = async (pgm) => {
  pgm.sql(`
    ALTER TABLE project_client_settings
      DROP CONSTRAINT IF EXISTS project_client_settings_milestone_source_check;
    ALTER TABLE project_client_settings
      DROP COLUMN IF EXISTS milestone_source;
  `);
};
