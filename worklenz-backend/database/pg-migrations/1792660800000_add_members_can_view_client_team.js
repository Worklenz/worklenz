'use strict';

/**
 * Add projects.members_can_view_client_team (default false).
 * When TRUE, normal project members can see the Client's team tab on Members.
 * Owners, Admins, Team Leads, and Project Managers always see the tab.
 */

/** @type {import('node-pg-migrate').ColumnDefinitions | undefined} */
exports.shorthands = undefined;

/** @param {import('node-pg-migrate').MigrationBuilder} pgm */
exports.up = async (pgm) => {
  pgm.sql(`
    ALTER TABLE projects
      ADD COLUMN IF NOT EXISTS members_can_view_client_team BOOLEAN DEFAULT FALSE;

    COMMENT ON COLUMN projects.members_can_view_client_team IS
      'When TRUE, normal project members can see the Client''s team tab. Privileged roles always can.';
  `);
};

/** @param {import('node-pg-migrate').MigrationBuilder} pgm */
exports.down = async (pgm) => {
  pgm.sql(`
    ALTER TABLE projects
      DROP COLUMN IF EXISTS members_can_view_client_team;
  `);
};
