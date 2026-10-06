'use strict';

/** @type {import('node-pg-migrate').ColumnDefinitions | undefined} */
exports.shorthands = undefined;

/** @param {import('node-pg-migrate').MigrationBuilder} pgm */
exports.up = async (pgm) => {
  pgm.sql(`
    INSERT INTO project_access_levels (name, key)
    VALUES ('Guest', 'GUEST')
    ON CONFLICT (key) DO NOTHING;
  `);
};

/** @param {import('node-pg-migrate').MigrationBuilder} pgm */
exports.down = async (pgm) => {
  pgm.sql(`
    DELETE FROM project_access_levels
    WHERE key = 'GUEST';
  `);
};
