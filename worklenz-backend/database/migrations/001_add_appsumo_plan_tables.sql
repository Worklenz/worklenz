-- Migration: Add AppSumo-specific Paddle plans
-- Version: 001
-- Description: Add AppSumo promotional plans to existing licensing_pricing_plans table
-- Note: Campaign management is handled by the licensing backend marketing campaigns system

-- Add AppSumo-specific pricing plans to the existing licensing_pricing_plans table
-- Using actual Paddle plan IDs provided

-- First, ensure we have the necessary plan tiers (in case they don't exist)
INSERT INTO licensing_plan_tiers (
    id,
    tier_name,
    display_name,
    tier_level,
    pricing_model,
    monthly_base_price,
    annual_base_price,
    monthly_per_user_price,
    annual_per_user_price,
    min_users,
    max_users,
    included_users,
    max_projects,
    max_storage_gb,
    is_active,
    sort_order
) VALUES 
(
    uuid_generate_v4(),
    'BUSINESS_APPSUMO',
    'Business (AppSumo)',
    3,
    'base_plan',
    49.50,
    414.00,
    0,
    0,
    1,
    50, -- Special 50 user limit for AppSumo
    25,
    -1, -- Unlimited projects
    100,
    true,
    103
),
(
    uuid_generate_v4(),
    'ENTERPRISE_APPSUMO', 
    'Enterprise (AppSumo)',
    4,
    'base_plan',
    174.50,
    1794.00,
    0,
    0,
    1,
    -1, -- Unlimited users
    -1, -- Unlimited included
    -1, -- Unlimited projects
    500,
    true,
    104
)
ON CONFLICT (tier_name) DO NOTHING;

-- Now insert the AppSumo-specific pricing plans
INSERT INTO licensing_pricing_plans (
    id, 
    name, 
    billing_type, 
    billing_period, 
    default_currency, 
    initial_price, 
    recurring_price, 
    trial_days, 
    paddle_id, 
    active,
    is_startup_plan,
    tier_id,
    description
) VALUES 
-- AppSumo Business Plans
(
    uuid_generate_v4(),
    'AppSumo Promo - Business (Monthly)',
    'month',
    1,
    'USD',
    '0',
    '49.50',
    0,
    82951,
    true,
    false,
    (SELECT id FROM licensing_plan_tiers WHERE tier_name = 'BUSINESS_APPSUMO' LIMIT 1),
    'AppSumo exclusive Business plan - Monthly billing at $49.50 with up to 50 users'
),
(
    uuid_generate_v4(),
    'AppSumo Promo - Business (Annual)',
    'year',
    12,
    'USD',
    '0',
    '414.00',
    0,
    82952,
    true,
    false,
    (SELECT id FROM licensing_plan_tiers WHERE tier_name = 'BUSINESS_APPSUMO' LIMIT 1),
    'AppSumo exclusive Business plan - Annual billing at $414.00 with up to 50 users'
),
-- AppSumo Enterprise Plans
(
    uuid_generate_v4(),
    'AppSumo Promo - Enterprise (Monthly)',
    'month',
    1,
    'USD',
    '0',
    '174.50',
    0,
    82949,
    true,
    false,
    (SELECT id FROM licensing_plan_tiers WHERE tier_name = 'ENTERPRISE_APPSUMO' LIMIT 1),
    'AppSumo exclusive Enterprise plan - Monthly billing at $174.50'
),
(
    uuid_generate_v4(),
    'AppSumo Promo - Enterprise (Annual)',
    'year',
    12,
    'USD',
    '0',
    '1794.00',
    0,
    82950,
    true,
    false,
    (SELECT id FROM licensing_plan_tiers WHERE tier_name = 'ENTERPRISE_APPSUMO' LIMIT 1),
    'AppSumo exclusive Enterprise plan - Annual billing at $1,794.00'
)
ON CONFLICT (paddle_id) DO UPDATE SET
    name = EXCLUDED.name,
    recurring_price = EXCLUDED.recurring_price,
    active = EXCLUDED.active,
    description = EXCLUDED.description;

-- Comments for reference
COMMENT ON TABLE licensing_pricing_plans IS 'Includes AppSumo promotional plans for discounted pricing';

-- Note: AppSumo campaign management is handled by the licensing backend:
-- - Campaign eligibility: licensing_marketing_campaigns table
-- - Discount application: check_campaign_eligibility() function
-- - Usage tracking: licensing_campaign_redemptions table
-- - Admin control: Licensing backend admin interface