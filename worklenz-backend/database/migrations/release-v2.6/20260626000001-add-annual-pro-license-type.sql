-- Add ANNUAL_PRO license type for LKR Pro plan subscribers
-- Previously all LKR subscribers (both Pro and Business tiers) were incorrectly
-- assigned ANNUAL_BUSINESS. This migration adds the correct type for Pro tier users.

INSERT INTO sys_license_types (id, key, name)
VALUES (uuid_generate_v4(), 'ANNUAL_PRO', 'Annual Pro Plan');

-- Fix existing Pro plan LKR subscribers who were incorrectly assigned ANNUAL_BUSINESS
UPDATE organizations
SET license_type_id = (SELECT id FROM sys_license_types WHERE key = 'ANNUAL_PRO')
WHERE user_id IN (
    SELECT lcs.user_id
    FROM licensing_custom_subs lcs
    JOIN licensing_custom_plan_pricing lpp ON lpp.id = lcs.plan_tier_id
    WHERE lcs.status IN ('active', 'pending')
      AND lpp.tier_name = 'pro'
);
