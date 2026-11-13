'use strict';
// Cascading (dependent) Selection custom fields.
// A Selection column may name one other Selection column in the same project as its parent
// (cc_column_configurations.parent_column_id). Each of its options is then grouped under one of the
// parent's options (cc_selection_options.parent_selection_id = the parent option's selection_id).
// An option whose parent_selection_id no longer matches any parent option is "Unassigned".
// Same-project, no-cycle and 2-level depth rules are enforced by the API, not here.

/** @type {import('node-pg-migrate').MigrationBuilder} pgm */
exports.up = async (pgm) => {
  pgm.sql(`
    ALTER TABLE cc_column_configurations
        ADD COLUMN IF NOT EXISTS parent_column_id UUID
            REFERENCES cc_custom_columns(id) ON DELETE SET NULL;

    CREATE INDEX IF NOT EXISTS idx_cc_column_configurations_parent_column_id
        ON cc_column_configurations(parent_column_id)
        WHERE parent_column_id IS NOT NULL;

    ALTER TABLE cc_selection_options
        ADD COLUMN IF NOT EXISTS parent_selection_id TEXT;
  `);
};

/** @type {import('node-pg-migrate').MigrationBuilder} pgm */
exports.down = async (pgm) => {
  pgm.sql(`
    ALTER TABLE cc_selection_options DROP COLUMN IF EXISTS parent_selection_id;
    DROP INDEX IF EXISTS idx_cc_column_configurations_parent_column_id;
    ALTER TABLE cc_column_configurations DROP COLUMN IF EXISTS parent_column_id;
  `);
};
