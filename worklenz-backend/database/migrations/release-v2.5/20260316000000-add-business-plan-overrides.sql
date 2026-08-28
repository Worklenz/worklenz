-- Migration: Add business plan override flags
-- Description: Adds manual override flags for business plan feature access and team member limits
-- Date: 2026-03-16

-- Add override columns to organizations table
ALTER TABLE organizations 
ADD COLUMN IF NOT EXISTS business_plan_override BOOLEAN DEFAULT FALSE NOT NULL,
ADD COLUMN IF NOT EXISTS team_member_limit_override BOOLEAN DEFAULT FALSE NOT NULL;

-- Add comments for documentation
COMMENT ON COLUMN organizations.business_plan_override IS 
'Manual override to grant business plan feature access (client portal, Slack, finance, etc.) regardless of subscription status. Set manually by admins.';

COMMENT ON COLUMN organizations.team_member_limit_override IS 
'Manual override to bypass all team member limits. When enabled, organization can add unlimited team members regardless of subscription plan.';

-- Create indexes for performance (partial indexes for TRUE values only)
CREATE INDEX IF NOT EXISTS idx_organizations_business_override 
ON organizations(business_plan_override) 
WHERE business_plan_override = TRUE;

CREATE INDEX IF NOT EXISTS idx_organizations_member_limit_override 
ON organizations(team_member_limit_override) 
WHERE team_member_limit_override = TRUE;
