'use strict';

/** @type {import('node-pg-migrate').ColumnDefinitions | undefined} */
exports.shorthands = undefined;

/** @param {import('node-pg-migrate').MigrationBuilder} pgm */
exports.up = async (pgm) => {
  pgm.sql(`
    ALTER TABLE task_templates
      ADD COLUMN IF NOT EXISTS scope TEXT NOT NULL DEFAULT 'team';

    ALTER TABLE task_templates
      DROP CONSTRAINT IF EXISTS task_templates_scope_check;

    ALTER TABLE task_templates
      ADD CONSTRAINT task_templates_scope_check
        CHECK (scope IN ('team', 'organization'));

    CREATE INDEX IF NOT EXISTS idx_task_templates_scope
      ON task_templates (scope);
  `);
};

/** @param {import('node-pg-migrate').MigrationBuilder} pgm */
exports.down = async (pgm) => {
  pgm.sql(`
    DROP INDEX IF EXISTS idx_task_templates_scope;

    ALTER TABLE task_templates
      DROP CONSTRAINT IF EXISTS task_templates_scope_check;

    ALTER TABLE task_templates
      DROP COLUMN IF EXISTS scope;
  `);
};
