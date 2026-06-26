'use strict';
// Converted from: database/migrations/release-v2.2.2-team-lead-role/20250922000000-add-reports-to-team-members.sql

/** @type {import('node-pg-migrate').ColumnDefinitions | undefined} */
exports.shorthands = undefined;

/** @param {import('node-pg-migrate').MigrationBuilder} pgm */
exports.up = async (pgm) => {
  pgm.sql(`
-- Migration: Add reports_to_member_id to team_members
-- Description: Adds a column to team_members to establish a reporting hierarchy

ALTER TABLE team_members
ADD COLUMN IF NOT EXISTS reports_to_member_id UUID,
ADD CONSTRAINT IF NOT EXISTS fk_reports_to_member
    FOREIGN KEY (reports_to_member_id)
    REFERENCES team_members(id)
    ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_reports_to_member_id ON team_members(reports_to_member_id);

  `);
};

/** @param {import('node-pg-migrate').MigrationBuilder} pgm */
exports.down = async (_pgm) => {
  // This migration is a DDL/function change — no automatic rollback defined.
  // Review manually before running migrate:down.
};
