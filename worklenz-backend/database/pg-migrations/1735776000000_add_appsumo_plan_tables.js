'use strict';
// Converted from: database/migrations/001_add_appsumo_plan_tables.sql

/** @type {import('node-pg-migrate').ColumnDefinitions | undefined} */
exports.shorthands = undefined;

/** @param {import('node-pg-migrate').MigrationBuilder} pgm */
exports.up = async (pgm) => {
  pgm.sql(`
ALTER TABLE public.licensing_pricing_plans
    ADD is_custom_pricing BOOLEAN DEFAULT FALSE;

ALTER TABLE public.licensing_pricing_plans
    ADD discount_percentage NUMERIC(5, 2) DEFAULT 0;

ALTER TABLE public.licensing_pricing_plans
    ADD sort_order NUMERIC;

ALTER TABLE public.licensing_pricing_plans
    ADD key VARCHAR(50);

ALTER TABLE public.licensing_pricing_plans
    ADD pricing_model TEXT;

ALTER TABLE licensing_pricing_plans
    ADD tier_id UUID;

ALTER TABLE licensing_pricing_plans
    ADD description TEXT;

ALTER TABLE public.licensing_pricing_plans
    DROP CONSTRAINT licensing_pricing_plans_pricing_model_check;

CREATE TABLE IF NOT EXISTS licensing_plan_tiers
(
    id                            UUID                     DEFAULT uuid_generate_v4() NOT NULL,
    tier_name                     TEXT                                                NOT NULL,
    display_name                  TEXT                                                NOT NULL,
    tier_level                    INTEGER                                             NOT NULL,
    pricing_model                 TEXT                                                NOT NULL,
    monthly_base_price            NUMERIC                  DEFAULT 0                  NOT NULL,
    annual_base_price             NUMERIC                  DEFAULT 0                  NOT NULL,
    monthly_per_user_price        NUMERIC                  DEFAULT 0                  NOT NULL,
    annual_per_user_price         NUMERIC                  DEFAULT 0                  NOT NULL,
    min_users                     INTEGER                  DEFAULT 1                  NOT NULL,
    max_users                     INTEGER                  DEFAULT '-1'::INTEGER      NOT NULL,
    included_users                INTEGER                  DEFAULT '-1'::INTEGER      NOT NULL,
    max_projects                  INTEGER                  DEFAULT '-1'::INTEGER      NOT NULL,
    max_storage_gb                INTEGER                  DEFAULT 5                  NOT NULL,
    has_api_access                BOOLEAN                  DEFAULT FALSE              NOT NULL,
    has_advanced_analytics        BOOLEAN                  DEFAULT FALSE              NOT NULL,
    has_custom_fields             BOOLEAN                  DEFAULT FALSE              NOT NULL,
    has_gantt_charts              BOOLEAN                  DEFAULT FALSE              NOT NULL,
    has_time_tracking             BOOLEAN                  DEFAULT FALSE              NOT NULL,
    has_resource_management       BOOLEAN                  DEFAULT FALSE              NOT NULL,
    has_portfolio_view            BOOLEAN                  DEFAULT FALSE              NOT NULL,
    has_custom_branding           BOOLEAN                  DEFAULT FALSE              NOT NULL,
    has_sso                       BOOLEAN                  DEFAULT FALSE              NOT NULL,
    has_audit_logs                BOOLEAN                  DEFAULT FALSE              NOT NULL,
    has_priority_support          BOOLEAN                  DEFAULT FALSE              NOT NULL,
    has_dedicated_account_manager BOOLEAN                  DEFAULT FALSE              NOT NULL,
    is_popular                    BOOLEAN                  DEFAULT FALSE              NOT NULL,
    is_active                     BOOLEAN                  DEFAULT TRUE               NOT NULL,
    sort_order                    INTEGER                  DEFAULT 0                  NOT NULL,
    created_at                    TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP  NOT NULL,
    updated_at                    TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP  NOT NULL
);

COMMENT ON TABLE licensing_plan_tiers IS 'Defines subscription plan tiers with features, pricing, and limits';

COMMENT ON COLUMN licensing_plan_tiers.id IS 'Unique identifier for the plan tier';

COMMENT ON COLUMN licensing_plan_tiers.tier_name IS 'Internal name for the tier (e.g., BUSINESS_APPSUMO)';

COMMENT ON COLUMN licensing_plan_tiers.display_name IS 'User-friendly display name (e.g., Business (AppSumo))';

COMMENT ON COLUMN licensing_plan_tiers.tier_level IS 'Numeric level indicating tier hierarchy (1=lowest, 10=highest)';

COMMENT ON COLUMN licensing_plan_tiers.pricing_model IS 'Pricing model: base_plan, per_user, or hybrid';

COMMENT ON COLUMN licensing_plan_tiers.monthly_base_price IS 'Base monthly price in USD';

COMMENT ON COLUMN licensing_plan_tiers.annual_base_price IS 'Base annual price in USD';

COMMENT ON COLUMN licensing_plan_tiers.monthly_per_user_price IS 'Additional monthly price per user';

COMMENT ON COLUMN licensing_plan_tiers.annual_per_user_price IS 'Additional annual price per user';

COMMENT ON COLUMN licensing_plan_tiers.min_users IS 'Minimum number of users required';

COMMENT ON COLUMN licensing_plan_tiers.max_users IS 'Maximum number of users allowed (-1 for unlimited)';

COMMENT ON COLUMN licensing_plan_tiers.included_users IS 'Number of users included in base price (-1 for unlimited)';

COMMENT ON COLUMN licensing_plan_tiers.max_projects IS 'Maximum number of projects allowed (-1 for unlimited)';

COMMENT ON COLUMN licensing_plan_tiers.max_storage_gb IS 'Maximum storage in GB';

COMMENT ON COLUMN licensing_plan_tiers.has_api_access IS 'Whether API access is included';

COMMENT ON COLUMN licensing_plan_tiers.has_advanced_analytics IS 'Whether advanced analytics are included';

COMMENT ON COLUMN licensing_plan_tiers.has_custom_fields IS 'Whether custom fields are available';

COMMENT ON COLUMN licensing_plan_tiers.has_gantt_charts IS 'Whether Gantt charts are available';

COMMENT ON COLUMN licensing_plan_tiers.has_time_tracking IS 'Whether time tracking is available';

COMMENT ON COLUMN licensing_plan_tiers.has_resource_management IS 'Whether resource management is available';

COMMENT ON COLUMN licensing_plan_tiers.has_portfolio_view IS 'Whether portfolio view is available';

COMMENT ON COLUMN licensing_plan_tiers.has_custom_branding IS 'Whether custom branding is available';

COMMENT ON COLUMN licensing_plan_tiers.has_sso IS 'Whether SSO is available';

COMMENT ON COLUMN licensing_plan_tiers.has_audit_logs IS 'Whether audit logs are available';

COMMENT ON COLUMN licensing_plan_tiers.has_priority_support IS 'Whether priority support is included';

COMMENT ON COLUMN licensing_plan_tiers.has_dedicated_account_manager IS 'Whether dedicated account manager is included';

COMMENT ON COLUMN licensing_plan_tiers.is_popular IS 'Whether this tier is marked as popular';

COMMENT ON COLUMN licensing_plan_tiers.is_active IS 'Whether this tier is currently active';

COMMENT ON COLUMN licensing_plan_tiers.sort_order IS 'Order for display purposes';

COMMENT ON COLUMN licensing_plan_tiers.created_at IS 'Timestamp when the tier was created';

COMMENT ON COLUMN licensing_plan_tiers.updated_at IS 'Timestamp when the tier was last updated';

CREATE INDEX IF NOT EXISTS idx_licensing_plan_tiers_tier_name
    ON licensing_plan_tiers (tier_name);

CREATE INDEX IF NOT EXISTS idx_licensing_plan_tiers_ordering
    ON licensing_plan_tiers (tier_level, sort_order);

CREATE INDEX IF NOT EXISTS idx_licensing_plan_tiers_active
    ON licensing_plan_tiers (is_active);

ALTER TABLE licensing_plan_tiers
    ADD CONSTRAINT IF NOT EXISTS licensing_plan_tiers_pk
        PRIMARY KEY (id);

ALTER TABLE licensing_plan_tiers
    ADD CONSTRAINT IF NOT EXISTS licensing_plan_tiers_tier_name_unique
        UNIQUE (tier_name);

ALTER TABLE licensing_plan_tiers
    ADD CONSTRAINT IF NOT EXISTS licensing_plan_tiers_pricing_model_check
        CHECK (pricing_model = ANY
               (ARRAY ['free'::TEXT, 'per_user'::TEXT, 'flat_rate_with_overage'::TEXT, 'unlimited'::TEXT]));

ALTER TABLE public.licensing_pricing_plans
    ADD CONSTRAINT IF NOT EXISTS licensing_pricing_plans_pricing_model_check
        CHECK (pricing_model = ANY (ARRAY ['per_user'::TEXT, 'base_plan'::TEXT]));

ALTER TABLE public.licensing_pricing_plans
    ADD CONSTRAINT IF NOT EXISTS licensing_pricing_plans_licensing_plan_tiers_id_fk
        FOREIGN KEY (tier_id) REFERENCES public.licensing_plan_tiers;

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
  `);
};

/** @param {import('node-pg-migrate').MigrationBuilder} pgm */
exports.down = async (_pgm) => {
  // This migration is a DDL/function change — no automatic rollback defined.
  // Review manually before running migrate:down.
};
