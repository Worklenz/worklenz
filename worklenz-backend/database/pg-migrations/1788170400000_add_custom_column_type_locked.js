'use strict';

/** @type {import('node-pg-migrate').ColumnDefinitions | undefined} */
exports.shorthands = undefined;

/** @param {import('node-pg-migrate').MigrationBuilder} pgm */
exports.up = async (pgm) => {
  pgm.sql(`
    ALTER TABLE cc_custom_columns
      ADD COLUMN IF NOT EXISTS type_locked BOOLEAN NOT NULL DEFAULT FALSE;

    COMMENT ON COLUMN cc_custom_columns.type_locked IS
      'When TRUE, field_type cannot be changed. Set TRUE after initial column setup or for existing columns.';

    -- Lock all existing columns so their types cannot be changed
    UPDATE cc_custom_columns
    SET type_locked = TRUE
    WHERE type_locked = FALSE;
  `);
};

/** @param {import('node-pg-migrate').MigrationBuilder} pgm */
exports.down = async (pgm) => {
  pgm.sql(`
    ALTER TABLE cc_custom_columns
      DROP COLUMN IF EXISTS type_locked;
  `);
};
