'use strict';

/** @param {import('node-pg-migrate').MigrationBuilder} pgm */
exports.up = (pgm) => {
  pgm.sql("ALTER TYPE language_type ADD VALUE IF NOT EXISTS 'zh_tw' AFTER 'zh_cn';");
};

exports.down = () => {
  throw new Error('Removing a PostgreSQL enum value is not supported.');
};
