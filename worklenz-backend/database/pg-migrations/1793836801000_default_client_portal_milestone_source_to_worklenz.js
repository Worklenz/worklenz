'use strict';

/** @type {import('node-pg-migrate').MigrationBuilder} pgm */
exports.up = async (pgm) => {
  pgm.sql(`
    ALTER TABLE project_client_settings
      ALTER COLUMN milestone_source SET DEFAULT 'worklenz';

    UPDATE project_client_settings
       SET milestone_source = 'worklenz'
     WHERE milestone_source = 'manual';
  `);
};

/** @type {import('node-pg-migrate').MigrationBuilder} pgm */
exports.down = async (pgm) => {
  pgm.sql(`
    ALTER TABLE project_client_settings
      ALTER COLUMN milestone_source SET DEFAULT 'manual';
  `);
};
