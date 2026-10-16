'use strict';

/** @type {import('node-pg-migrate').ColumnDefinitions | undefined} */
exports.shorthands = undefined;

/** @param {import('node-pg-migrate').MigrationBuilder} pgm */
exports.up = async (pgm) => {
  pgm.sql(`
DO $$
BEGIN
    ALTER TYPE LANGUAGE_TYPE ADD VALUE IF NOT EXISTS 'pl';
EXCEPTION
    WHEN duplicate_object THEN
        NULL;
END $$;
`);
};

/** @param {import('node-pg-migrate').MigrationBuilder} pgm */
exports.down = async (_pgm) => {
  // Enum values cannot be removed in PostgreSQL without recreating the type
};
