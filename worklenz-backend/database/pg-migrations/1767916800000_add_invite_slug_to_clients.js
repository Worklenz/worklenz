'use strict';
// Converted from: database/migrations/release-v2.3.1/20251212000000-add-invite-slug-to-clients.sql

/** @type {import('node-pg-migrate').ColumnDefinitions | undefined} */
exports.shorthands = undefined;

/** @param {import('node-pg-migrate').MigrationBuilder} pgm */
exports.up = async (pgm) => {
  pgm.sql(`
-- Migration: Add invite slug for vanity URLs
-- Description: Adds invite_slug column to clients table for custom/memorable invitation URLs
-- Date: 2025-12-12
-- Version: 2.3.1

-- Add invite_slug column to clients table
ALTER TABLE clients ADD COLUMN IF NOT EXISTS invite_slug TEXT;

-- CREATE UNIQUE INDEX IF NOT EXISTS on invite_slug (case-insensitive)
-- Only enforce uniqueness when invite_slug is not NULL
CREATE UNIQUE INDEX IF NOT EXISTS clients_invite_slug_unique
  ON clients (LOWER(invite_slug))
  WHERE invite_slug IS NOT NULL;

-- CREATE INDEX IF NOT EXISTS for faster lookups
CREATE INDEX IF NOT EXISTS idx_clients_invite_slug
  ON clients (invite_slug)
  WHERE invite_slug IS NOT NULL;

-- ADD CONSTRAINT IF NOT EXISTS to ensure slug format (lowercase alphanumeric and hyphens only)
-- Drop constraint if exists, then add it
DO $$
BEGIN
    ALTER TABLE clients DROP CONSTRAINT IF EXISTS clients_invite_slug_format;
    ALTER TABLE clients ADD CONSTRAINT IF NOT EXISTS clients_invite_slug_format
      CHECK (invite_slug ~ '^[a-z0-9-]+$');
EXCEPTION
    WHEN duplicate_object THEN NULL;
END $$;

-- ADD CONSTRAINT IF NOT EXISTS for minimum length (at least 3 characters)
DO $$
BEGIN
    ALTER TABLE clients DROP CONSTRAINT IF EXISTS clients_invite_slug_length;
    ALTER TABLE clients ADD CONSTRAINT IF NOT EXISTS clients_invite_slug_length
      CHECK (invite_slug IS NULL OR LENGTH(invite_slug) >= 3);
EXCEPTION
    WHEN duplicate_object THEN NULL;
END $$;

-- ADD CONSTRAINT IF NOT EXISTS for maximum length (max 50 characters)
DO $$
BEGIN
    ALTER TABLE clients DROP CONSTRAINT IF EXISTS clients_invite_slug_max_length;
    ALTER TABLE clients ADD CONSTRAINT IF NOT EXISTS clients_invite_slug_max_length
      CHECK (invite_slug IS NULL OR LENGTH(invite_slug) <= 50);
EXCEPTION
    WHEN duplicate_object THEN NULL;
END $$;

-- Comment on column
COMMENT ON COLUMN clients.invite_slug IS 'Custom vanity URL slug for client invitations (e.g., "acme-corp" for portal.app.com/i/acme-corp)';

  `);
};

/** @param {import('node-pg-migrate').MigrationBuilder} pgm */
exports.down = async (_pgm) => {
  // This migration is a DDL/function change — no automatic rollback defined.
  // Review manually before running migrate:down.
};
