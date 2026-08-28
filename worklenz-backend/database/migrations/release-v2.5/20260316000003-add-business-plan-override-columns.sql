-- Migration: Add Business Plan override columns to organizations table
-- Date: 2026-03-16
-- Description: Add columns to override plan name and team member limit for AppSumo users who redeem 5 codes

-- Add business plan override column (boolean to indicate Business Plan is activated)
ALTER TABLE organizations 
ADD COLUMN IF NOT EXISTS business_plan_override BOOLEAN DEFAULT FALSE;

-- Add team member limit override column (boolean to bypass member limit checks)
ALTER TABLE organizations 
ADD COLUMN IF NOT EXISTS team_member_limit_override BOOLEAN DEFAULT FALSE;

-- Add comments
COMMENT ON COLUMN organizations.business_plan_override IS 'Flag to indicate if Business Plan features are activated via AppSumo codes';
COMMENT ON COLUMN organizations.team_member_limit_override IS 'Flag to bypass team member limit checks (manual override)';
