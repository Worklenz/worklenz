'use strict';

/** @type {import('node-pg-migrate').ColumnDefinitions | undefined} */
exports.shorthands = undefined;

/**
 * Creates the table. It depends on client_portal_requests, which is created by
 * 1753401600000_create_client_portal_tables, so on a fresh database this runs
 * from 1753401610000_create_client_portal_request_comments_after_tables instead.
 */
/** @param {import('node-pg-migrate').MigrationBuilder} pgm */
const createRequestComments = (pgm) => {
  pgm.sql(`
-- Migration: Create Client Portal Request Comments Table
-- Description: Creates a dedicated table for tracking comments on client portal requests
-- Date: 2025-01-XX
-- Version: 2.3.1

-- Client Portal Request Comments Table
CREATE TABLE IF NOT EXISTS client_portal_request_comments (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    request_id UUID NOT NULL REFERENCES client_portal_requests(id) ON DELETE CASCADE,
    organization_team_id UUID NOT NULL REFERENCES teams(id) ON DELETE CASCADE,
    client_id UUID NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
    
    -- Comment content
    comment TEXT NOT NULL,
    
    -- Sender information
    sender_type TEXT NOT NULL CHECK (sender_type IN ('client', 'team_member')),
    sender_id UUID NOT NULL, -- Can be user_id or client_relationship_id
    sender_name TEXT, -- Cached name for display
    
    -- Timestamps
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Add indexes for performance
CREATE INDEX IF NOT EXISTS idx_client_portal_request_comments_request_id ON client_portal_request_comments(request_id);
CREATE INDEX IF NOT EXISTS idx_client_portal_request_comments_org_team_id ON client_portal_request_comments(organization_team_id);
CREATE INDEX IF NOT EXISTS idx_client_portal_request_comments_client_id ON client_portal_request_comments(client_id);
CREATE INDEX IF NOT EXISTS idx_client_portal_request_comments_created_at ON client_portal_request_comments(created_at DESC);

-- Add comments for documentation
COMMENT ON TABLE client_portal_request_comments IS 'Tracks all comments on client portal requests';
COMMENT ON COLUMN client_portal_request_comments.sender_type IS 'Indicates whether the comment was made by a client or team member';
COMMENT ON COLUMN client_portal_request_comments.sender_id IS 'ID of the sender (user_id for team_member, client_relationship_id for client)';
COMMENT ON COLUMN client_portal_request_comments.sender_name IS 'Cached name of the sender for quick display without joins';



  `);
};

exports.createRequestComments = createRequestComments;

/** @param {import('node-pg-migrate').MigrationBuilder} pgm */
exports.up = async (pgm) => {
  const { rows } = await pgm.db.query("SELECT to_regclass('client_portal_requests') AS t");
  if (rows[0].t) {
    createRequestComments(pgm);
  }
};

/** @param {import('node-pg-migrate').MigrationBuilder} pgm */
exports.down = async (_pgm) => {
  // Historical SQL migration: no automatic rollback is available.
};
