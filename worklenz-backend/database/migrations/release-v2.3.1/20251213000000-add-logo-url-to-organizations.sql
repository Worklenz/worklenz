-- Migration: Add logo_url column to organizations table
-- Description: Adds logo_url column to organizations table for custom organization logos
-- Date: 2025-12-13
-- Version: 2.3.1

-- Add logo_url column to organizations table
ALTER TABLE organizations ADD COLUMN IF NOT EXISTS logo_url TEXT;

-- Comment on column
COMMENT ON COLUMN organizations.logo_url IS 'URL to the organization logo stored in S3';

