'use strict';
// Converted from: database/migrations/20260105000007-fix-client-portal-request-unique-constraint.sql

/** @type {import('node-pg-migrate').ColumnDefinitions | undefined} */
exports.shorthands = undefined;

/** @param {import('node-pg-migrate').MigrationBuilder} pgm */
exports.up = async (pgm) => {
  pgm.sql(`
-- Migration: Fix Client Portal Request Unique Constraint
-- Description: Changes req_no constraint from globally unique to unique per service
-- Date: 2026-01-05
-- Issue: Request numbers should be unique per service, not globally

-- Drop the existing unique constraint on req_no
ALTER TABLE client_portal_requests 
DROP CONSTRAINT IF EXISTS client_portal_requests_req_no_key;

-- Add composite unique constraint on (service_id, req_no)
-- This allows each service to have their own sequence (REQ-0001, REQ-0002, etc.)
ALTER TABLE client_portal_requests
ADD CONSTRAINT IF NOT EXISTS client_portal_requests_service_req_no_unique 
UNIQUE (service_id, req_no);

-- Add index for performance on the composite key
CREATE INDEX IF NOT EXISTS idx_client_portal_requests_service_req_no 
ON client_portal_requests(service_id, req_no);


  `);
};

/** @param {import('node-pg-migrate').MigrationBuilder} pgm */
exports.down = async (_pgm) => {
  // This migration is a DDL/function change — no automatic rollback defined.
  // Review manually before running migrate:down.
};
