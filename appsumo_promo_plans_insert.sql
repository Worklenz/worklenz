-- AppSumo Promo Plan Tiers and Pricing Plans Insert Script
-- Generated for AppSumo promotional pricing structure

-- Insert AppSumo Business Tier
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
    has_api_access,
    has_advanced_analytics,
    has_custom_fields,
    has_gantt_charts,
    has_time_tracking,
    has_resource_management,
    has_portfolio_view,
    has_custom_branding,
    has_sso,
    has_audit_logs,
    has_priority_support,
    has_dedicated_account_manager,
    is_popular,
    is_active,
    sort_order,
    created_at,
    updated_at
) VALUES (
    uuid_generate_v4(),
    'APPSUMO_BUSINESS',
    'Business (AppSumo Promo)',
    6,
    'flat_rate_with_overage',
    49.50,  -- 50% off from $99
    594.00, -- 50% off from $1188 annual
    0,
    0,
    1,
    100,    -- Special AppSumo limit: up to 100 users
    100,    -- All 100 users included in flat rate
    -1,     -- Unlimited projects
    100,    -- 100GB storage
    true,   -- API access
    true,   -- Advanced analytics
    true,   -- Custom fields
    true,   -- Gantt charts
    true,   -- Time tracking
    true,   -- Resource management
    true,   -- Portfolio view
    true,   -- Custom branding
    true,   -- SSO
    true,   -- Audit logs
    true,   -- Priority support
    false,  -- No dedicated account manager
    true,   -- Popular plan
    true,   -- Active
    6,      -- Sort order
    CURRENT_TIMESTAMP,
    CURRENT_TIMESTAMP
);

-- Insert AppSumo Enterprise Tier
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
    has_api_access,
    has_advanced_analytics,
    has_custom_fields,
    has_gantt_charts,
    has_time_tracking,
    has_resource_management,
    has_portfolio_view,
    has_custom_branding,
    has_sso,
    has_audit_logs,
    has_priority_support,
    has_dedicated_account_manager,
    is_popular,
    is_active,
    sort_order,
    created_at,
    updated_at
) VALUES (
    uuid_generate_v4(),
    'APPSUMO_ENTERPRISE',
    'Enterprise (AppSumo Promo)',
    8,
    'unlimited',
    99.50,  -- 50% off from $199
    1194.00, -- 50% off from $2388 annual
    0,
    0,
    1,
    -1,     -- Unlimited users
    -1,     -- Unlimited users included
    -1,     -- Unlimited projects
    -1,     -- Unlimited storage (represented as -1)
    true,   -- API access
    true,   -- Advanced analytics
    true,   -- Custom fields
    true,   -- Gantt charts
    true,   -- Time tracking
    true,   -- Resource management
    true,   -- Portfolio view
    true,   -- Custom branding
    true,   -- SSO
    true,   -- Audit logs
    true,   -- Priority support
    true,   -- Dedicated account manager
    false,  -- Not the most popular (Business is)
    true,   -- Active
    8,      -- Sort order
    CURRENT_TIMESTAMP,
    CURRENT_TIMESTAMP
);

-- Get the tier IDs for the pricing plans (using variables for clarity)
-- Note: In actual execution, you'll need to replace these with actual UUIDs from the above inserts

-- Insert AppSumo Business Monthly Plan
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
    pricing_model,
    max_users,
    min_users,
    flat_rate_price,
    tier_id,
    description,
    is_custom_pricing,
    discount_percentage,
    sort_order,
    key
) VALUES (
    uuid_generate_v4(),
    'AppSumo Business Monthly',
    'month',
    1,
    'USD',
    '49.50',
    '49.50',
    0,
    0, -- Replace with actual Paddle plan ID
    true,
    false,
    'base_plan',
    100,
    1,
    49.50,
    (SELECT id FROM licensing_plan_tiers WHERE tier_name = 'APPSUMO_BUSINESS'),
    'AppSumo promotional Business plan - monthly billing, up to 100 users included',
    true,
    50.00, -- 50% discount
    1,
    'APPSUMO_BUSINESS_MONTHLY'
);

-- Insert AppSumo Business Annual Plan
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
    pricing_model,
    max_users,
    min_users,
    flat_rate_price,
    tier_id,
    description,
    is_custom_pricing,
    discount_percentage,
    sort_order,
    key
) VALUES (
    uuid_generate_v4(),
    'AppSumo Business Annual',
    'year',
    1,
    'USD',
    '594.00',
    '594.00',
    0,
    0, -- Replace with actual Paddle plan ID
    true,
    false,
    'base_plan',
    100,
    1,
    594.00,
    (SELECT id FROM licensing_plan_tiers WHERE tier_name = 'APPSUMO_BUSINESS'),
    'AppSumo promotional Business plan - annual billing, up to 100 users included',
    true,
    50.00, -- 50% discount
    2,
    'APPSUMO_BUSINESS_ANNUAL'
);

-- Insert AppSumo Enterprise Monthly Plan
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
    pricing_model,
    max_users,
    min_users,
    flat_rate_price,
    tier_id,
    description,
    is_custom_pricing,
    discount_percentage,
    sort_order,
    key
) VALUES (
    uuid_generate_v4(),
    'AppSumo Enterprise Monthly',
    'month',
    1,
    'USD',
    '99.50',
    '99.50',
    0,
    0, -- Replace with actual Paddle plan ID
    true,
    false,
    'base_plan',
    -1, -- Unlimited users
    1,
    99.50,
    (SELECT id FROM licensing_plan_tiers WHERE tier_name = 'APPSUMO_ENTERPRISE'),
    'AppSumo promotional Enterprise plan - monthly billing, unlimited users',
    true,
    50.00, -- 50% discount
    3,
    'APPSUMO_ENTERPRISE_MONTHLY'
);

-- Insert AppSumo Enterprise Annual Plan
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
    pricing_model,
    max_users,
    min_users,
    flat_rate_price,
    tier_id,
    description,
    is_custom_pricing,
    discount_percentage,
    sort_order,
    key
) VALUES (
    uuid_generate_v4(),
    'AppSumo Enterprise Annual',
    'year',
    1,
    'USD',
    '1194.00',
    '1194.00',
    0,
    0, -- Replace with actual Paddle plan ID
    true,
    false,
    'base_plan',
    -1, -- Unlimited users
    1,
    1194.00,
    (SELECT id FROM licensing_plan_tiers WHERE tier_name = 'APPSUMO_ENTERPRISE'),
    'AppSumo promotional Enterprise plan - annual billing, unlimited users',
    true,
    50.00, -- 50% discount
    4,
    'APPSUMO_ENTERPRISE_ANNUAL'
);

-- Verify the inserts
SELECT 
    t.tier_name,
    t.display_name,
    t.pricing_model,
    t.monthly_base_price,
    t.annual_base_price,
    t.max_users,
    t.included_users
FROM licensing_plan_tiers t
WHERE t.tier_name IN ('APPSUMO_BUSINESS', 'APPSUMO_ENTERPRISE');

SELECT 
    p.name,
    p.billing_type,
    p.recurring_price,
    p.max_users,
    p.discount_percentage,
    p.key,
    t.tier_name
FROM licensing_pricing_plans p
JOIN licensing_plan_tiers t ON p.tier_id = t.id
WHERE t.tier_name IN ('APPSUMO_BUSINESS', 'APPSUMO_ENTERPRISE')
ORDER BY p.key;