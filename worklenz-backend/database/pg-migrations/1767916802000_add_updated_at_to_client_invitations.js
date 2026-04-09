'use strict';
// Converted from: database/migrations/release-v2.3.1/20251212000002-add-updated-at-to-client-invitations.sql

/** @type {import('node-pg-migrate').ColumnDefinitions | undefined} */
exports.shorthands = undefined;

/** @param {import('node-pg-migrate').MigrationBuilder} pgm */
exports.up = async (pgm) => {
  pgm.sql(`
-- Add updated_at column to client_invitations table
-- This column is needed for tracking when invitations are resent

ALTER TABLE client_invitations 
ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW();

-- Update existing rows to have updated_at equal to created_at
UPDATE client_invitations 
SET updated_at = created_at 
WHERE updated_at IS NULL;

  `);
};

/** @param {import('node-pg-migrate').MigrationBuilder} pgm */
exports.down = async (_pgm) => {
  // This migration is a DDL/function change — no automatic rollback defined.
  // Review manually before running migrate:down.
};
