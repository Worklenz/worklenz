'use strict';

/** @type {import('node-pg-migrate').ColumnDefinitions | undefined} */
exports.shorthands = undefined;

/** @param {import('node-pg-migrate').MigrationBuilder} pgm */
exports.up = async (pgm) => {
  pgm.sql(`
    ALTER TABLE custom_project_templates
      ADD COLUMN IF NOT EXISTS scope TEXT NOT NULL DEFAULT 'team';

    ALTER TABLE custom_project_templates
      DROP CONSTRAINT IF EXISTS custom_project_templates_scope_check;

    ALTER TABLE custom_project_templates
      ADD CONSTRAINT custom_project_templates_scope_check
        CHECK (scope IN ('team', 'organization'));

    CREATE INDEX IF NOT EXISTS idx_custom_project_templates_scope
      ON custom_project_templates (scope);
  `);
};

/** @param {import('node-pg-migrate').MigrationBuilder} pgm */
exports.down = async (pgm) => {
  pgm.sql(`
    DROP INDEX IF EXISTS idx_custom_project_templates_scope;

    ALTER TABLE custom_project_templates
      DROP CONSTRAINT IF EXISTS custom_project_templates_scope_check;

    ALTER TABLE custom_project_templates
      DROP COLUMN IF EXISTS scope;
  `);
};
