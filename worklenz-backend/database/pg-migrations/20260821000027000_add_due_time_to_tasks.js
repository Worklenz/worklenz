'use strict';
// Converted from database/migrations/20260424000001-add-due-time-to-tasks.sql

/** @type {import('node-pg-migrate').ColumnDefinitions | undefined} */
exports.shorthands = undefined;

/** @param {import('node-pg-migrate').MigrationBuilder} pgm */
exports.up = async (pgm) => {
  pgm.sql(`
-- Migration: Add due_time column to tasks table
-- This stores the due time separately from end_date (date-only field)

ALTER TABLE tasks ADD COLUMN IF NOT EXISTS due_time TIME;

  `);
};

/** @param {import('node-pg-migrate').MigrationBuilder} pgm */
exports.down = async (_pgm) => {
  // Review manually before running migrate:down.
};
