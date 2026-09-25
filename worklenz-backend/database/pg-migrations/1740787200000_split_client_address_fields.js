'use strict';

/** @type {import('node-pg-migrate').ColumnDefinitions | undefined} */
exports.shorthands = undefined;

/** @param {import('node-pg-migrate').MigrationBuilder} pgm */
exports.up = async pgm => {
  pgm.sql(`
    ALTER TABLE clients
      ADD COLUMN IF NOT EXISTS address_line_1 TEXT,
      ADD COLUMN IF NOT EXISTS city TEXT,
      ADD COLUMN IF NOT EXISTS state TEXT,
      ADD COLUMN IF NOT EXISTS zip_code TEXT,
      ADD COLUMN IF NOT EXISTS country TEXT;
  `);
};

/** @param {import('node-pg-migrate').MigrationBuilder} pgm */
exports.down = async pgm => {
  pgm.dropColumns('clients', ['address_line_1', 'city', 'state', 'zip_code', 'country']);
};
