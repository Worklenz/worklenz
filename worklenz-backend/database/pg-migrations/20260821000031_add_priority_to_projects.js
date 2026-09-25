'use strict';
// Converted from database/migrations/20260507000000-add-priority-to-projects.sql

/** @type {import('node-pg-migrate').ColumnDefinitions | undefined} */
exports.shorthands = undefined;

/** @param {import('node-pg-migrate').MigrationBuilder} pgm */
exports.up = async (pgm) => {
  pgm.sql(`
-- Migration: Add priority column to projects table
-- Date: 2026-05-07

ALTER TABLE projects
    ADD COLUMN IF NOT EXISTS priority_id UUID REFERENCES task_priorities (id) ON DELETE SET NULL;

COMMENT ON COLUMN projects.priority_id IS 'Optional project-level priority (references task_priorities)';

  `);
};

/** @param {import('node-pg-migrate').MigrationBuilder} pgm */
exports.down = async (_pgm) => {
  // Review manually before running migrate:down.
};
