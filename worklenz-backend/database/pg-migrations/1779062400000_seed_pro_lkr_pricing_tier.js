/* eslint-disable camelcase */

exports.up = pgm => {
  pgm.sql(`
    -- Ensure unique constraint exists
    DO $$
    BEGIN
        IF NOT EXISTS (
            SELECT 1 FROM pg_constraint
            WHERE conrelid = 'licensing_custom_plan_pricing'::regclass
              AND conname = 'licensing_custom_plan_pricing_tier_name_currency_key'
        ) THEN
            ALTER TABLE licensing_custom_plan_pricing
                ADD CONSTRAINT licensing_custom_plan_pricing_tier_name_currency_key
                UNIQUE (tier_name, currency);
        END IF;
    END $$;

    -- Insert Pro tier (prices start at 0 — configure via admin panel)
    INSERT INTO licensing_custom_plan_pricing (
        tier_name, tier_level, display_name,
        monthly_base_price, annual_base_price,
        included_users, max_users,
        monthly_per_user_price, annual_per_user_price,
        currency, is_active, sort_order
    ) VALUES (
        'pro', 1, 'Pro Plan',
        0, 0,
        15, 50,
        NULL, NULL,
        'LKR', true, 1
    )
    ON CONFLICT (tier_name, currency) DO NOTHING;

    -- Ensure business tier sort_order is correct
    UPDATE licensing_custom_plan_pricing SET sort_order = 2 WHERE tier_name = 'business' AND currency = 'LKR';
  `);
};

exports.down = pgm => {
  pgm.sql(`
    DELETE FROM licensing_custom_plan_pricing WHERE tier_name = 'pro' AND currency = 'LKR';
  `);
};
