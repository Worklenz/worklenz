-- Add new columns to licensing_pricing_plans table
ALTER TABLE licensing_pricing_plans
    ADD COLUMN IF NOT EXISTS max_users INTEGER,
    ADD COLUMN IF NOT EXISTS min_users INTEGER DEFAULT 1,
    ADD COLUMN IF NOT EXISTS flat_rate_price NUMERIC(10, 2) DEFAULT NULL,
    ADD COLUMN IF NOT EXISTS user_limit INTEGER DEFAULT 0 NOT NULL,
    ADD COLUMN IF NOT EXISTS features JSONB DEFAULT '{}'::JSONB NOT NULL,
    ADD COLUMN IF NOT EXISTS created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP NOT NULL,
    ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP NOT NULL;

-- Add comments for the new columns
COMMENT ON COLUMN licensing_pricing_plans.max_users IS 'Maximum number of users for this plan (-1 for unlimited)';
COMMENT ON COLUMN licensing_pricing_plans.min_users IS 'Minimum number of users required for this plan';
COMMENT ON COLUMN licensing_pricing_plans.flat_rate_price IS 'Flat rate price for base_plan pricing model';
COMMENT ON COLUMN licensing_pricing_plans.user_limit IS 'Maximum number of users allowed in this plan (-1 for unlimited)';
COMMENT ON COLUMN licensing_pricing_plans.features IS 'JSON object containing plan features and capabilities';
COMMENT ON COLUMN licensing_pricing_plans.created_at IS 'Timestamp when the plan was created';
COMMENT ON COLUMN licensing_pricing_plans.updated_at IS 'Timestamp when the plan was last updated';