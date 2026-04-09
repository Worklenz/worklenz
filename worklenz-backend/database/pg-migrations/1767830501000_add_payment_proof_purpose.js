'use strict';
// Converted from: database/migrations/20260103000001-add-payment-proof-purpose.sql

/** @type {import('node-pg-migrate').ColumnDefinitions | undefined} */
exports.shorthands = undefined;

/** @param {import('node-pg-migrate').MigrationBuilder} pgm */
exports.up = async (pgm) => {
  pgm.sql(`
-- Migration: Add payment_proof to client_portal_attachments purpose constraint
-- Description: Adds 'payment_proof' as a valid purpose for client portal attachments
-- Date: 2026-01-03
-- Version: 2.3.2

-- Drop the existing CHECK constraint
ALTER TABLE client_portal_attachments
DROP CONSTRAINT IF EXISTS client_portal_attachments_purpose_check;

-- Add the new CHECK constraint with payment_proof included
ALTER TABLE client_portal_attachments
ADD CONSTRAINT IF NOT EXISTS client_portal_attachments_purpose_check 
CHECK (purpose IN ('request', 'chat', 'avatar', 'document', 'payment_proof', 'general'));

-- Update the comment to reflect the new purpose
COMMENT ON COLUMN client_portal_attachments.purpose IS 'Categorizes the attachment: request (request attachments), chat (chat files), avatar (profile pictures), document (general documents), payment_proof (payment proof images/files), general (uncategorized)';


  `);
};

/** @param {import('node-pg-migrate').MigrationBuilder} pgm */
exports.down = async (_pgm) => {
  // This migration is a DDL/function change — no automatic rollback defined.
  // Review manually before running migrate:down.
};
