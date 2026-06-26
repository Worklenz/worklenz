'use strict';
// Converted from: database/migrations/20260105000006-create-client-portal-request-sequences.sql

/** @type {import('node-pg-migrate').ColumnDefinitions | undefined} */
exports.shorthands = undefined;

/** @param {import('node-pg-migrate').MigrationBuilder} pgm */
exports.up = async (pgm) => {
  pgm.sql(`
-- Migration: Create Client Portal Request Sequences Table
-- Description: Creates the sequence tracking table for client portal request numbers
-- Date: 2026-01-05
-- Issue: Missing sequence table causing duplicate key violations on req_no

-- CREATE SEQUENCE IF NOT EXISTS tracking table
CREATE TABLE IF NOT EXISTS client_portal_request_sequences (
    organization_team_id UUID PRIMARY KEY REFERENCES teams(id) ON DELETE CASCADE,
    last_request_number INTEGER NOT NULL DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Add index for performance
CREATE INDEX IF NOT EXISTS idx_client_portal_request_sequences_org_team_id 
ON client_portal_request_sequences(organization_team_id);

-- Initialize sequences for existing organizations that have requests
INSERT INTO client_portal_request_sequences (organization_team_id, last_request_number, created_at, updated_at)
SELECT 
    organization_team_id,
    COALESCE(
        MAX(
            CASE 
                WHEN req_no ~ '^REQ-[0-9]+$' 
                THEN CAST(SUBSTRING(req_no FROM 5) AS INTEGER)
                ELSE 0
            END
        ),
        0
    ) as last_request_number,
    NOW(),
    NOW()
FROM client_portal_requests
GROUP BY organization_team_id
ON CONFLICT (organization_team_id) DO UPDATE
SET 
    last_request_number = GREATEST(
        client_portal_request_sequences.last_request_number,
        EXCLUDED.last_request_number
    ),
    updated_at = NOW();

  `);
};

/** @param {import('node-pg-migrate').MigrationBuilder} pgm */
exports.down = async (_pgm) => {
  // This migration is a DDL/function change — no automatic rollback defined.
  // Review manually before running migrate:down.
};
