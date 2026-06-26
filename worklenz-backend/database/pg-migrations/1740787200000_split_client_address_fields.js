'use strict';

/** @type {import('node-pg-migrate').ColumnDefinitions | undefined} */
exports.shorthands = undefined;

/** @param {import('node-pg-migrate').MigrationBuilder} pgm */
exports.up = async pgm => {
  pgm.addColumns('clients', {
    address_line_1: { type: 'text' },
    city:           { type: 'text' },
    state:          { type: 'text' },
    zip_code:       { type: 'text' },
    country:        { type: 'text' },
  });
};

/** @param {import('node-pg-migrate').MigrationBuilder} pgm */
exports.down = async pgm => {
  pgm.dropColumns('clients', ['address_line_1', 'city', 'state', 'zip_code', 'country']);
};
