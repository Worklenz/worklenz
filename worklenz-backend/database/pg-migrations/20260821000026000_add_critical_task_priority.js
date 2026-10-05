'use strict';
// Converted from database/migrations/20260403000000-add-critical-task-priority.sql

/** @type {import('node-pg-migrate').ColumnDefinitions | undefined} */
exports.shorthands = undefined;

/** @param {import('node-pg-migrate').MigrationBuilder} pgm */
exports.up = async (pgm) => {
  pgm.sql(`
INSERT INTO task_priorities (name, value, color_code, color_code_dark)
SELECT 'Critical', 3, '#8B1A1A', '#B22222'
WHERE NOT EXISTS (
  SELECT 1
  FROM task_priorities
  WHERE LOWER(name) = 'critical' OR value = 3
);

  `);
};

/** @param {import('node-pg-migrate').MigrationBuilder} pgm */
exports.down = async (_pgm) => {
  // Review manually before running migrate:down.
};
