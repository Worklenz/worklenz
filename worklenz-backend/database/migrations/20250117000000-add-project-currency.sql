-- Migration: Add currency column to projects table
-- Date: 2025-01-17
-- Description: Adds project-specific currency support to allow different projects to use different currencies

-- Add currency column to projects table
ALTER TABLE projects
    ADD COLUMN IF NOT EXISTS currency VARCHAR(3) DEFAULT 'USD';

-- Add comment for documentation
COMMENT ON COLUMN projects.currency IS 'Project-specific currency code (e.g., USD, EUR, GBP, JPY, etc.)';

-- Add constraint to ensure currency codes are uppercase and 3 characters
ALTER TABLE projects
    ADD CONSTRAINT projects_currency_format_check 
    CHECK (currency ~ '^[A-Z]{3}$');

-- Update existing projects to have a default currency if they don't have one
UPDATE projects 
SET currency = 'USD' 
WHERE currency IS NULL; 