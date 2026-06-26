'use strict';
// Converted from: database/migrations/20260102000000-fix-client-status-null-values.sql

/** @type {import('node-pg-migrate').ColumnDefinitions | undefined} */
exports.shorthands = undefined;

/** @param {import('node-pg-migrate').MigrationBuilder} pgm */
exports.up = async (pgm) => {
  pgm.sql(`
-- Migration to fix NULL status values in clients table
-- This ensures all existing clients have a valid status value

-- First, check if the status column exists, if not, add it
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'clients' AND column_name = 'status'
    ) THEN
        ALTER TABLE clients ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'active';
    END IF;
END $$;

-- Update all clients with NULL status to 'active' (the default)
UPDATE clients 
SET status = 'active', 
    updated_at = NOW() 
WHERE status IS NULL;

-- Ensure the status column has the proper constraint
-- First drop the existing constraint if it exists
ALTER TABLE clients DROP CONSTRAINT IF EXISTS clients_status_check;

-- Set default and NOT NULL
ALTER TABLE clients 
ALTER COLUMN status SET DEFAULT 'active';

-- Make the column NOT NULL (now that all NULL values are updated)
ALTER TABLE clients 
ALTER COLUMN status SET NOT NULL;

-- Re-add the check constraint
ALTER TABLE clients 
ADD CONSTRAINT IF NOT EXISTS clients_status_check 
CHECK (status IN ('active', 'inactive', 'pending'));

-- Create indexes on status column for better filter performance
-- Drop existing indexes first to avoid duplicates
DROP INDEX IF EXISTS idx_clients_status;
DROP INDEX IF EXISTS idx_clients_team_status;

-- Create new indexes
CREATE INDEX IF NOT EXISTS idx_clients_status ON clients(status);
CREATE INDEX IF NOT EXISTS idx_clients_team_status ON clients(team_id, status);

  `);
};

/** @param {import('node-pg-migrate').MigrationBuilder} pgm */
exports.down = async (_pgm) => {
  // This migration is a DDL/function change — no automatic rollback defined.
  // Review manually before running migrate:down.
};
