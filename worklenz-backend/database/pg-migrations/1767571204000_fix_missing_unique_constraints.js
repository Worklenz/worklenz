'use strict';
// Converted from: database/migrations/release-v2.3.0/003-fix-missing-unique-constraints.sql

/** @type {import('node-pg-migrate').ColumnDefinitions | undefined} */
exports.shorthands = undefined;

/** @param {import('node-pg-migrate').MigrationBuilder} pgm */
exports.up = async (pgm) => {
  pgm.sql(`
-- Migration: Fix missing columns and constraints for client portal
-- Description: Adds missing columns and unique constraints required for client portal invitation acceptance
-- Date: 2025-12-17
-- Version: 2.3.0

-- Add user_id column to client_users for linking Worklenz users
-- This allows existing Worklenz users to be linked to client portal accounts
ALTER TABLE client_users ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES users(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS idx_client_users_user_id ON client_users(user_id);

-- Make password_hash nullable since linked users don't need it
ALTER TABLE client_users ALTER COLUMN password_hash DROP NOT NULL;

-- Add unique constraint to client_user_organizations if not exists
-- This is needed for: ON CONFLICT (client_user_id, team_id) DO NOTHING
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint 
        WHERE conname = 'client_user_organizations_client_user_id_team_id_key'
    ) THEN
        ALTER TABLE client_user_organizations 
        ADD CONSTRAINT IF NOT EXISTS client_user_organizations_client_user_id_team_id_key 
        UNIQUE (client_user_id, team_id);
    END IF;
END $$;

-- Add unique constraint to client_portal_access if not exists
-- This is needed for: ON CONFLICT (client_id) DO UPDATE
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint 
        WHERE conname = 'client_portal_access_client_id_key'
    ) THEN
        ALTER TABLE client_portal_access 
        ADD CONSTRAINT IF NOT EXISTS client_portal_access_client_id_key 
        UNIQUE (client_id);
    END IF;
END $$;

  `);
};

/** @param {import('node-pg-migrate').MigrationBuilder} pgm */
exports.down = async (_pgm) => {
  // This migration is a DDL/function change — no automatic rollback defined.
  // Review manually before running migrate:down.
};
