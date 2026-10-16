'use strict';
// Client Portal branding: lets an organization show or hide the "Powered by Worklenz" footer
// in the client portal. Defaults to visible so existing portals are unchanged.

/** @type {import('node-pg-migrate').MigrationBuilder} pgm */
exports.up = async (pgm) => {
  pgm.sql(`
    ALTER TABLE client_portal_settings
      ADD COLUMN IF NOT EXISTS show_powered_by BOOLEAN NOT NULL DEFAULT TRUE;
  `);
};

/** @type {import('node-pg-migrate').MigrationBuilder} pgm */
exports.down = async (pgm) => {
  pgm.sql(`
    ALTER TABLE client_portal_settings
      DROP COLUMN IF EXISTS show_powered_by;
  `);
};
