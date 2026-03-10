'use strict';
// Converted from: database/migrations/release-v2.3.1/20251207000000-add-notes-to-client-portal-invoices.sql

/** @type {import('node-pg-migrate').ColumnDefinitions | undefined} */
exports.shorthands = undefined;

/** @param {import('node-pg-migrate').MigrationBuilder} pgm */
exports.up = async (pgm) => {
  pgm.sql(`
-- Migration: Add notes column to client_portal_invoices
-- Description: Adds the missing notes column to support invoice notes functionality
-- Date: 2025-12-07

-- Add notes column to client_portal_invoices table
ALTER TABLE client_portal_invoices 
ADD COLUMN IF NOT EXISTS notes TEXT;

-- Add comment for documentation
COMMENT ON COLUMN client_portal_invoices.notes IS 'Optional notes or description for the invoice';

  `);
};

/** @param {import('node-pg-migrate').MigrationBuilder} pgm */
exports.down = async (_pgm) => {
  // This migration is a DDL/function change — no automatic rollback defined.
  // Review manually before running migrate:down.
};
