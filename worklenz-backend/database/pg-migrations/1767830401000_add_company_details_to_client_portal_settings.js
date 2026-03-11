'use strict';
// Converted from: database/migrations/release-v2.3.1/20251207000001-add-company-details-to-client-portal-settings.sql

/** @type {import('node-pg-migrate').ColumnDefinitions | undefined} */
exports.shorthands = undefined;

/** @param {import('node-pg-migrate').MigrationBuilder} pgm */
exports.up = async (pgm) => {
  pgm.sql(`
-- Migration: Add company details to client_portal_settings
-- Version: 2.2.1
-- Description: Add company_name and address columns for invoice branding

-- Add company_name column
ALTER TABLE client_portal_settings ADD COLUMN IF NOT EXISTS company_name TEXT;

-- Add address_line_1 column
ALTER TABLE client_portal_settings ADD COLUMN IF NOT EXISTS address_line_1 TEXT;

-- Add address_line_2 column
ALTER TABLE client_portal_settings ADD COLUMN IF NOT EXISTS address_line_2 TEXT;

-- Add invoice_footer_message column for customizable thank you message
ALTER TABLE client_portal_settings ADD COLUMN IF NOT EXISTS invoice_footer_message TEXT;

  `);
};

/** @param {import('node-pg-migrate').MigrationBuilder} pgm */
exports.down = async (_pgm) => {
  // This migration is a DDL/function change — no automatic rollback defined.
  // Review manually before running migrate:down.
};
