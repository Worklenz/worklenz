'use strict';
// Converted from: database/migrations/release-v2.3.0/002-add-user-id-to-client-users.sql

/** @type {import('node-pg-migrate').ColumnDefinitions | undefined} */
exports.shorthands = undefined;

/** @param {import('node-pg-migrate').MigrationBuilder} pgm */
exports.up = async (pgm) => {
  pgm.sql(`
-- Migration: Add user_id to client_users for Worklenz User Linking
-- Description: Allows Worklenz users to access client portal with their existing credentials
-- Date: 2025-10-02
-- Version: 2.3.0

-- Add user_id column to client_users table (nullable to support both linked and standalone accounts)
ALTER TABLE client_users ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES users(id) ON DELETE CASCADE;

-- CREATE INDEX IF NOT EXISTS for user_id to improve query performance
CREATE INDEX IF NOT EXISTS idx_client_users_user_id ON client_users(user_id);

-- Add unique constraint to prevent same Worklenz user from being linked to same client multiple times
-- Note: user_id can be NULL for standalone client accounts
CREATE UNIQUE INDEX IF NOT EXISTS idx_client_users_user_client_unique
ON client_users(user_id, client_id)
WHERE user_id IS NOT NULL;

-- Make password_hash nullable since Worklenz users authenticate via users table
ALTER TABLE client_users ALTER COLUMN password_hash DROP NOT NULL;

-- Add check constraint to ensure either user_id OR password_hash exists (not both null)
ALTER TABLE client_users ADD CONSTRAINT IF NOT EXISTS client_users_auth_check
CHECK (user_id IS NOT NULL OR password_hash IS NOT NULL);

-- Add comments for documentation
COMMENT ON COLUMN client_users.user_id IS 'Links to Worklenz user for single sign-on. NULL for standalone client portal accounts.';
COMMENT ON CONSTRAINT client_users_auth_check ON client_users IS 'Ensures authentication method exists: either linked Worklenz user (user_id) or client portal password (password_hash)';

  `);
};

/** @param {import('node-pg-migrate').MigrationBuilder} pgm */
exports.down = async (_pgm) => {
  // This migration is a DDL/function change — no automatic rollback defined.
  // Review manually before running migrate:down.
};
