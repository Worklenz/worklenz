'use strict';
// Converted from: database/migrations/20260103000000-add-payment-proof-url-to-invoices.sql

/** @type {import('node-pg-migrate').ColumnDefinitions | undefined} */
exports.shorthands = undefined;

/** @param {import('node-pg-migrate').MigrationBuilder} pgm */
exports.up = async (pgm) => {
  pgm.sql(`
-- Migration: Add Payment Proof URL to Client Portal Invoices
-- Description: Adds payment_proof_url column to store payment proof images/files submitted by clients
-- Date: 2026-01-03
-- Version: 2.3.2

-- Add payment_proof_url column to client_portal_invoices table
ALTER TABLE client_portal_invoices
ADD COLUMN IF NOT EXISTS payment_proof_url TEXT;

-- Add index for better query performance when filtering by payment proof
CREATE INDEX IF NOT EXISTS idx_client_portal_invoices_payment_proof_url 
ON client_portal_invoices(payment_proof_url) 
WHERE payment_proof_url IS NOT NULL;

-- Add comment to document the column
COMMENT ON COLUMN client_portal_invoices.payment_proof_url IS 'URL of the payment proof file/image submitted by the client when paying the invoice';


  `);
};

/** @param {import('node-pg-migrate').MigrationBuilder} pgm */
exports.down = async (_pgm) => {
  // This migration is a DDL/function change — no automatic rollback defined.
  // Review manually before running migrate:down.
};
