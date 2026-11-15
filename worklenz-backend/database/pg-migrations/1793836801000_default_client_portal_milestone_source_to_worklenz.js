'use strict';

/** @type {import('node-pg-migrate').MigrationBuilder} pgm */
exports.up = async (pgm) => {
  pgm.sql(`
    ALTER TABLE project_client_settings
      ALTER COLUMN milestone_source SET DEFAULT 'worklenz';

    UPDATE project_client_settings
       SET milestone_source = 'worklenz'
     WHERE milestone_source = 'manual'
       AND NOT EXISTS (
         SELECT 1 FROM client_portal_milestones m WHERE m.project_id = project_client_settings.project_id
       );
  `);
};

/** @type {import('node-pg-migrate').MigrationBuilder} pgm */
exports.down = async (pgm) => {
  pgm.sql(`
    ALTER TABLE project_client_settings
      ALTER COLUMN milestone_source SET DEFAULT 'manual';
  `);
};
