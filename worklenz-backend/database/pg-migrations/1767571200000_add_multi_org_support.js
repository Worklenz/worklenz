'use strict';
// Converted from: database/migrations/release-v2.3.0/001-add-multi-org-support.sql

/** @type {import('node-pg-migrate').ColumnDefinitions | undefined} */
exports.shorthands = undefined;

/** @param {import('node-pg-migrate').MigrationBuilder} pgm */
exports.up = async (pgm) => {
  pgm.sql(`
-- Migration: Add Multi-Organization Support for Client Portal
-- Description: Enables client users to access multiple organizations without separate logins
-- Date: 2025-10-02
-- Version: 2.3.0

-- Add team_id to client_users table to track which organization they belong to
ALTER TABLE client_users ADD COLUMN IF NOT EXISTS team_id UUID REFERENCES teams(id) ON DELETE CASCADE;

-- CREATE INDEX IF NOT EXISTS for team_id
CREATE INDEX IF NOT EXISTS idx_client_users_team_id ON client_users(team_id);

-- Create junction table for client users to access multiple organizations
CREATE TABLE IF NOT EXISTS client_user_organizations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    client_user_id UUID NOT NULL REFERENCES client_users(id) ON DELETE CASCADE,
    team_id UUID NOT NULL REFERENCES teams(id) ON DELETE CASCADE,
    client_id UUID NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
    is_default BOOLEAN DEFAULT FALSE,
    access_level VARCHAR(20) DEFAULT 'member' CHECK (access_level IN ('member', 'admin', 'viewer')),
    last_accessed_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(client_user_id, team_id)
);

-- Create indexes for client_user_organizations
CREATE INDEX IF NOT EXISTS idx_client_user_orgs_user_id ON client_user_organizations(client_user_id);
CREATE INDEX IF NOT EXISTS idx_client_user_orgs_team_id ON client_user_organizations(team_id);
CREATE INDEX IF NOT EXISTS idx_client_user_orgs_client_id ON client_user_organizations(client_id);

-- Migrate existing client_users data to populate team_id and client_user_organizations
-- For each client_user, find their organization through the clients table
UPDATE client_users cu
SET team_id = c.team_id
FROM clients c
WHERE cu.client_id = c.id
AND cu.team_id IS NULL;

-- Populate client_user_organizations with existing client_users
-- This creates initial organization access records for all existing users
INSERT INTO client_user_organizations (client_user_id, team_id, client_id, is_default, created_at, updated_at)
SELECT
    cu.id,
    cu.team_id,
    cu.client_id,
    TRUE, -- Set first organization as default
    NOW(),
    NOW()
FROM client_users cu
WHERE cu.team_id IS NOT NULL
ON CONFLICT (client_user_id, team_id) DO NOTHING;

-- Add comment to explain the purpose
COMMENT ON TABLE client_user_organizations IS 'Junction table allowing client users to access multiple organizations';
COMMENT ON COLUMN client_user_organizations.is_default IS 'Indicates the default organization to use on login';
COMMENT ON COLUMN client_user_organizations.access_level IS 'Permission level for this organization: member, admin, or viewer';
COMMENT ON COLUMN client_user_organizations.last_accessed_at IS 'Timestamp of last organization switch or access';

  `);
};

/** @param {import('node-pg-migrate').MigrationBuilder} pgm */
exports.down = async (_pgm) => {
  // This migration is a DDL/function change — no automatic rollback defined.
  // Review manually before running migrate:down.
};
