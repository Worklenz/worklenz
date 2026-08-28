-- Migration: Add Pricing and Category Fields to Services
-- Description: Adds price, currency, and category columns to client_portal_services table
-- Date: 2025-12-01
-- Version: 2.2.0

-- Add pricing and category columns to client_portal_services
ALTER TABLE client_portal_services 
ADD COLUMN IF NOT EXISTS price NUMERIC(10,2),
ADD COLUMN IF NOT EXISTS currency TEXT DEFAULT 'USD',
ADD COLUMN IF NOT EXISTS category TEXT;

-- Add index for category for filtering
CREATE INDEX IF NOT EXISTS idx_client_portal_services_category ON client_portal_services(category);

-- Add comment for documentation
COMMENT ON COLUMN client_portal_services.price IS 'Service price in the specified currency';
COMMENT ON COLUMN client_portal_services.currency IS 'Currency code (e.g., USD, EUR, GBP)';
COMMENT ON COLUMN client_portal_services.category IS 'Service category for organization and filtering';
