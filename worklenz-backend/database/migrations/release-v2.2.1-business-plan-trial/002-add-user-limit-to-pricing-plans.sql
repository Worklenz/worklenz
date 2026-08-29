-- Migration: Add user_limit column to licensing_pricing_plans
-- Description: Adds user_limit column to track maximum users allowed per pricing plan
-- Date: 2025-10-13
-- Version: 2.3.0

-- Add user_limit column to licensing_pricing_plans table
ALTER TABLE licensing_pricing_plans 
ADD COLUMN IF NOT EXISTS user_limit INTEGER DEFAULT -1;

-- Add comment to explain the column
COMMENT ON COLUMN licensing_pricing_plans.user_limit IS 'Maximum number of users allowed in this plan. -1 means unlimited.';

-- Update existing plans with sensible defaults based on plan names
-- These are placeholder values - adjust according to your actual pricing tiers
UPDATE licensing_pricing_plans 
SET user_limit = CASE 
    WHEN LOWER(name) LIKE '%free%' OR LOWER(name) LIKE '%trial%' THEN 3
    WHEN LOWER(name) LIKE '%starter%' OR LOWER(name) LIKE '%small%' THEN 10
    WHEN LOWER(name) LIKE '%professional%' OR LOWER(name) LIKE '%pro%' THEN 25
    WHEN LOWER(name) LIKE '%business%' OR LOWER(name) LIKE '%team%' THEN 50
    WHEN LOWER(name) LIKE '%enterprise%' OR LOWER(name) LIKE '%unlimited%' THEN -1
    ELSE -1  -- Default to unlimited for unrecognized plans
END
WHERE user_limit IS NULL OR user_limit = -1;

-- Also need to add  columns that subscription controller expects
ALTER TABLE licensing_pricing_plans 
ADD COLUMN IF NOT EXISTS key VARCHAR(50);

ALTER TABLE licensing_pricing_plans 
ADD COLUMN IF NOT EXISTS features JSONB DEFAULT '[]'::jsonb;

ALTER TABLE licensing_pricing_plans 
ADD COLUMN IF NOT EXISTS sort_order INTEGER DEFAULT 0;

-- Create index on key for faster lookups
CREATE INDEX IF NOT EXISTS idx_licensing_pricing_plans_key ON licensing_pricing_plans(key);

-- Add comments
COMMENT ON COLUMN licensing_pricing_plans.key IS 'Unique key identifier for the plan (e.g., pro-small, pro-large)';
COMMENT ON COLUMN licensing_pricing_plans.features IS 'JSON array of feature flags/names available in this plan';
COMMENT ON COLUMN licensing_pricing_plans.sort_order IS 'Display order for plan listings (lower numbers appear first)';

