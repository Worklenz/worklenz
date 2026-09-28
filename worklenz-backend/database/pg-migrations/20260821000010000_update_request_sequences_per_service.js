'use strict';
// Converted from database/migrations/20260105000008-update-request-sequences-per-service.sql

/** @type {import('node-pg-migrate').ColumnDefinitions | undefined} */
exports.shorthands = undefined;

/** @param {import('node-pg-migrate').MigrationBuilder} pgm */
exports.up = async (pgm) => {
  pgm.sql(`
-- Migration: Update Request Sequences to be Per Service
-- Description: Changes sequence tracking from per-organization to per-service
-- Date: 2026-01-05
-- Issue: Request numbers should be unique per service, not per organization

-- Drop the old sequence table
DROP TABLE IF EXISTS client_portal_request_sequences;

-- Create new sequence tracking table per service
CREATE TABLE IF NOT EXISTS client_portal_request_sequences (
    service_id UUID PRIMARY KEY REFERENCES client_portal_services(id) ON DELETE CASCADE,
    last_request_number INTEGER NOT NULL DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Add index for performance
CREATE INDEX IF NOT EXISTS idx_client_portal_request_sequences_service_id 
ON client_portal_request_sequences(service_id);

-- Initialize sequences for existing services that have requests
INSERT INTO client_portal_request_sequences (service_id, last_request_number, created_at, updated_at)
SELECT 
    service_id,
    COALESCE(
        MAX(
            CASE 
                WHEN req_no ~ '[0-9]+$' 
                THEN CAST(SUBSTRING(req_no FROM '[0-9]+$') AS INTEGER)
                ELSE 0
            END
        ),
        0
    ) as last_request_number,
    NOW(),
    NOW()
FROM client_portal_requests
GROUP BY service_id
ON CONFLICT (service_id) DO UPDATE
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
  // Review manually before running migrate:down.
};
