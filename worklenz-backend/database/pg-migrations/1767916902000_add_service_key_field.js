'use strict';
// Converted from: database/migrations/20260105000009-add-service-key-field.sql

/** @type {import('node-pg-migrate').ColumnDefinitions | undefined} */
exports.shorthands = undefined;

/** @param {import('node-pg-migrate').MigrationBuilder} pgm */
exports.up = async (pgm) => {
  pgm.sql(`
-- Migration: Add Service Key Field
-- Description: Adds service_key field to client_portal_services for use in request numbers
-- Date: 2026-01-05
-- Purpose: Include service identifier in request numbers (e.g., REQ-WEB-0001, REQ-MOB-0002)

-- Add service_key column to client_portal_services
ALTER TABLE client_portal_services
ADD COLUMN IF NOT EXISTS service_key TEXT;

-- Add CHECK constraint to validate service_key format
-- Rules: 2-6 characters, uppercase alphanumeric only (A-Z, 0-9)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint 
    WHERE conname = 'chk_service_key_format' 
    AND conrelid = 'client_portal_services'::regclass
  ) THEN
    ALTER TABLE client_portal_services
    ADD CONSTRAINT IF NOT EXISTS chk_service_key_format 
    CHECK (
      service_key IS NULL OR (
        LENGTH(service_key) >= 2 AND 
        LENGTH(service_key) <= 6 AND 
        service_key ~ '^[A-Z0-9]+$'
      )
    );
  END IF;
END $$;

-- Create unique constraint on (organization_team_id, service_key) to ensure uniqueness per org
CREATE UNIQUE INDEX IF NOT EXISTS idx_client_portal_services_org_key 
ON client_portal_services(organization_team_id, service_key) 
WHERE service_key IS NOT NULL;

-- Generate service keys for existing services based on name
-- Format: First 2-4 uppercase alphanumeric characters from service name
-- If name is too short or has no valid characters, use UUID short
-- Handle duplicates by appending numbers
DO $$
DECLARE
  service_record RECORD;
  base_key TEXT;
  unique_key TEXT;
  counter INTEGER;
  key_exists BOOLEAN;
BEGIN
  FOR service_record IN 
    SELECT id, name, organization_team_id 
    FROM client_portal_services 
    WHERE service_key IS NULL
    ORDER BY created_at
  LOOP
    -- Generate base key from name
    base_key := UPPER(
      CASE 
        WHEN LENGTH(REGEXP_REPLACE(service_record.name, '[^A-Za-z0-9]', '', 'g')) >= 2 THEN
          SUBSTRING(REGEXP_REPLACE(service_record.name, '[^A-Za-z0-9]', '', 'g') FROM 1 FOR 4)
        ELSE
          SUBSTRING(REGEXP_REPLACE(service_record.id::TEXT, '[^A-Za-z0-9]', '', 'g') FROM 1 FOR 4)
      END
    );
    
    -- Ensure base key is at least 2 characters
    IF LENGTH(base_key) < 2 THEN
      base_key := SUBSTRING(REGEXP_REPLACE(service_record.id::TEXT, '[^A-Za-z0-9]', '', 'g') FROM 1 FOR 4);
    END IF;
    
    -- Try base key first
    unique_key := base_key;
    counter := 1;
    
    -- Check if key exists and find unique one
    LOOP
      SELECT EXISTS(
        SELECT 1 FROM client_portal_services 
        WHERE organization_team_id = service_record.organization_team_id 
        AND service_key = unique_key
        AND id != service_record.id
      ) INTO key_exists;
      
      EXIT WHEN NOT key_exists;
      
      -- Key exists, try appending number (max 6 chars total)
      IF counter > 999 THEN
        -- Fallback to UUID-based key if too many conflicts
        unique_key := UPPER(SUBSTRING(REGEXP_REPLACE(service_record.id::TEXT, '[^A-Za-z0-9]', '', 'g') FROM 1 FOR 6));
        EXIT;
      END IF;
      
      DECLARE
        base_length INTEGER := GREATEST(0, 6 - LENGTH(counter::TEXT));
        base_part TEXT := SUBSTRING(base_key FROM 1 FOR base_length);
      BEGIN
        unique_key := base_part || counter::TEXT;
      END;
      
      counter := counter + 1;
    END LOOP;
    
    -- Update service with unique key
    UPDATE client_portal_services
    SET service_key = unique_key
    WHERE id = service_record.id;
  END LOOP;
END $$;

-- Add comment for documentation
COMMENT ON COLUMN client_portal_services.service_key IS 'Short unique identifier (2-6 uppercase alphanumeric characters) for the service, used in request numbers (e.g., WEB, MOB, SVC1). Must be unique per organization and editable.';


  `);
};

/** @param {import('node-pg-migrate').MigrationBuilder} pgm */
exports.down = async (_pgm) => {
  // This migration is a DDL/function change — no automatic rollback defined.
  // Review manually before running migrate:down.
};
