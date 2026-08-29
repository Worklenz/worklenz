-- Add LKR pricing tiers for local Sri Lankan market
-- This migration populates the licensing_custom_plan_pricing table with LKR pricing

INSERT INTO licensing_custom_plan_pricing (
    tier_name,
    tier_level,
    display_name,
    monthly_base_price,
    annual_base_price,
    included_users,
    max_users,
    monthly_per_user_price,
    annual_per_user_price,
    currency,
    features,
    is_active,
    sort_order
) VALUES 
(
    'pro',
    1,
    'Pro Plan (LKR)',
    75000,  -- LKR 75,000 per month
    840000, -- LKR 840,000 per year (~12% discount)
    15,
    50,
    1800,   -- LKR 1,800 per additional user per month
    20160,  -- LKR 20,160 per additional user per year
    'LKR',
    '{"unlimited_projects": true, "gantt_charts": true, "time_tracking": true}',
    true,
    1
),
(
    'business',
    2,
    'Business Plan (LKR)',
    120000, -- LKR 120,000 per month
    1320000, -- LKR 1,320,000 per year (~10% discount)
    20,
    100,
    1800,   -- LKR 1,800 per additional user per month
    20160,  -- LKR 20,160 per additional user per year
    'LKR',
    '{"unlimited_projects": true, "client_portal": true, "api_access": true, "advanced_analytics": true}',
    true,
    2
),
(
    'enterprise',
    3,
    'Enterprise Plan (LKR)',
    350000, -- LKR 350,000 per month
    3850000, -- LKR 3,850,000 per year (~10% discount)
    100,
    NULL,   -- Unlimited users
    NULL,   -- No per-user pricing for enterprise
    NULL,
    'LKR',
    '{"unlimited_projects": true, "sso": true, "priority_support": true, "dedicated_account_manager": true, "custom_branding": true}',
    true,
    3
)
ON CONFLICT (tier_name, currency) DO UPDATE SET
    display_name = EXCLUDED.display_name,
    tier_level = EXCLUDED.tier_level,
    monthly_base_price = EXCLUDED.monthly_base_price,
    annual_base_price = EXCLUDED.annual_base_price,
    included_users = EXCLUDED.included_users,
    max_users = EXCLUDED.max_users,
    monthly_per_user_price = EXCLUDED.monthly_per_user_price,
    annual_per_user_price = EXCLUDED.annual_per_user_price,
    features = EXCLUDED.features,
    is_active = EXCLUDED.is_active,
    sort_order = EXCLUDED.sort_order,
    updated_at = CURRENT_TIMESTAMP;

-- Verify the tiers were created
SELECT 
    tier_name, 
    display_name, 
    monthly_base_price,
    annual_base_price,
    currency,
    is_active
FROM licensing_custom_plan_pricing 
WHERE currency = 'LKR'
ORDER BY tier_level;
