/* eslint-disable camelcase */

exports.up = pgm => {
  pgm.sql(`
    CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

    CREATE TABLE IF NOT EXISTS licensing_payment_gateways (
        id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
        name TEXT NOT NULL UNIQUE,
        display_name TEXT NOT NULL,
        is_active BOOLEAN DEFAULT true,
        supports_recurring BOOLEAN DEFAULT true,
        supported_currencies TEXT[],
        created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
    );

    INSERT INTO licensing_payment_gateways (name, display_name, supported_currencies, supports_recurring)
    VALUES
        ('paddle', 'Paddle', ARRAY['USD'], true),
        ('directpay', 'DirectPay', ARRAY['LKR'], true),
        ('manual', 'Manual/Admin', ARRAY['LKR', 'USD'], false)
    ON CONFLICT (name) DO NOTHING;

    CREATE TABLE IF NOT EXISTS licensing_custom_plan_pricing (
        id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
        tier_name TEXT NOT NULL,
        tier_level INTEGER NOT NULL,
        display_name TEXT NOT NULL,
        monthly_base_price NUMERIC(10,2) NOT NULL,
        annual_base_price NUMERIC(10,2) NOT NULL,
        currency TEXT DEFAULT 'LKR',
        included_users INTEGER NOT NULL DEFAULT 0,
        max_users INTEGER,
        monthly_per_user_price NUMERIC(10,2),
        annual_per_user_price NUMERIC(10,2),
        features JSONB,
        is_active BOOLEAN DEFAULT true,
        sort_order INTEGER DEFAULT 0,
        created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
        UNIQUE (tier_name, currency)
    );

    ALTER TABLE licensing_custom_plan_pricing ADD COLUMN IF NOT EXISTS sort_order INTEGER DEFAULT 0;
    ALTER TABLE licensing_custom_plan_pricing ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP;

    DO $$
    BEGIN
        IF NOT EXISTS (
            SELECT 1
            FROM pg_constraint
            WHERE conrelid = 'licensing_custom_plan_pricing'::regclass
              AND conname = 'licensing_custom_plan_pricing_tier_name_currency_key'
        ) THEN
            ALTER TABLE licensing_custom_plan_pricing
                ADD CONSTRAINT licensing_custom_plan_pricing_tier_name_currency_key
                UNIQUE (tier_name, currency);
        END IF;
    END $$;

    CREATE TABLE IF NOT EXISTS licensing_directpay_cards (
        id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
        user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        card_id TEXT NOT NULL,
        card_number_masked TEXT NOT NULL,
        card_brand TEXT,
        card_type TEXT,
        expiry_month TEXT,
        expiry_year TEXT,
        wallet_id TEXT NOT NULL,
        is_default BOOLEAN DEFAULT false,
        is_active BOOLEAN DEFAULT true,
        created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
        last_used_at TIMESTAMPTZ,
        UNIQUE(user_id, card_id)
    );

    CREATE INDEX IF NOT EXISTS idx_directpay_cards_user_id ON licensing_directpay_cards(user_id);
    CREATE INDEX IF NOT EXISTS idx_directpay_cards_active_default ON licensing_directpay_cards(user_id, is_active, is_default);

    CREATE TABLE IF NOT EXISTS licensing_lkr_payments (
        id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
        user_id UUID REFERENCES users(id),
        owner_id UUID REFERENCES users(id),
        status TEXT,
        card_id TEXT,
        card_number TEXT,
        card_brand TEXT,
        card_type TEXT,
        card_issuer TEXT,
        card_expiry_year TEXT,
        card_expiry_month TEXT,
        wallet_id TEXT,
        transaction_id TEXT,
        transaction_status TEXT,
        transaction_amount NUMERIC(10,2),
        amount NUMERIC(10,2),
        transaction_currency TEXT,
        transaction_channel TEXT,
        transaction_datetime TIMESTAMPTZ,
        transaction_message TEXT,
        transaction_description TEXT,
        created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
    );

    ALTER TABLE licensing_lkr_payments ADD COLUMN IF NOT EXISTS owner_id UUID REFERENCES users(id);
    ALTER TABLE licensing_lkr_payments ADD COLUMN IF NOT EXISTS amount NUMERIC(10,2);
    ALTER TABLE licensing_lkr_payments ADD COLUMN IF NOT EXISTS subscription_id UUID REFERENCES licensing_custom_subs(id);
    ALTER TABLE licensing_lkr_payments ADD COLUMN IF NOT EXISTS billing_type TEXT DEFAULT 'month';
    ALTER TABLE licensing_lkr_payments ADD COLUMN IF NOT EXISTS payment_type TEXT DEFAULT 'initial';
    ALTER TABLE licensing_lkr_payments ADD COLUMN IF NOT EXISTS is_recurring BOOLEAN DEFAULT false;
    ALTER TABLE licensing_lkr_payments ADD COLUMN IF NOT EXISTS next_billing_date DATE;
    ALTER TABLE licensing_lkr_payments ADD COLUMN IF NOT EXISTS order_id TEXT;
    ALTER TABLE licensing_lkr_payments ADD COLUMN IF NOT EXISTS directpay_subscription_id TEXT;
    ALTER TABLE licensing_lkr_payments ADD COLUMN IF NOT EXISTS refund_amount NUMERIC(10,2);
    ALTER TABLE licensing_lkr_payments ADD COLUMN IF NOT EXISTS refund_reason TEXT;
    ALTER TABLE licensing_lkr_payments ADD COLUMN IF NOT EXISTS refunded_at TIMESTAMPTZ;

    CREATE INDEX IF NOT EXISTS idx_lkr_payments_order_id ON licensing_lkr_payments(order_id);
    CREATE INDEX IF NOT EXISTS idx_lkr_payments_transaction_id ON licensing_lkr_payments(transaction_id);
    CREATE INDEX IF NOT EXISTS idx_lkr_payments_subscription_created ON licensing_lkr_payments(subscription_id, created_at DESC);

    ALTER TABLE licensing_custom_subs ADD COLUMN IF NOT EXISTS payment_gateway_id UUID REFERENCES licensing_payment_gateways(id);
    ALTER TABLE licensing_custom_subs ADD COLUMN IF NOT EXISTS plan_tier_id UUID REFERENCES licensing_custom_plan_pricing(id);
    ALTER TABLE licensing_custom_subs ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'active';
    ALTER TABLE licensing_custom_subs ADD COLUMN IF NOT EXISTS next_billing_date DATE;
    ALTER TABLE licensing_custom_subs ADD COLUMN IF NOT EXISTS last_payment_date DATE;
    ALTER TABLE licensing_custom_subs ADD COLUMN IF NOT EXISTS auto_renew BOOLEAN DEFAULT true;
    ALTER TABLE licensing_custom_subs ADD COLUMN IF NOT EXISTS directpay_subscription_id TEXT;
    ALTER TABLE licensing_custom_subs ADD COLUMN IF NOT EXISTS card_id UUID REFERENCES licensing_directpay_cards(id);
    ALTER TABLE licensing_custom_subs ADD COLUMN IF NOT EXISTS cancellation_reason TEXT;
    ALTER TABLE licensing_custom_subs ADD COLUMN IF NOT EXISTS cancelled_at TIMESTAMPTZ;
    ALTER TABLE licensing_custom_subs ADD COLUMN IF NOT EXISTS retry_count INTEGER DEFAULT 0;
    ALTER TABLE licensing_custom_subs ADD COLUMN IF NOT EXISTS last_retry_at TIMESTAMPTZ;
    ALTER TABLE licensing_custom_subs ADD COLUMN IF NOT EXISTS next_retry_date DATE;
    ALTER TABLE licensing_custom_subs ADD COLUMN IF NOT EXISTS grace_period_ends DATE;

    DO $$
    DECLARE
        constraint_record RECORD;
    BEGIN
        FOR constraint_record IN
            SELECT conname
            FROM pg_constraint
            WHERE conrelid = 'licensing_custom_subs'::regclass
              AND contype = 'c'
              AND pg_get_constraintdef(oid) ILIKE '%status%'
        LOOP
            EXECUTE format('ALTER TABLE licensing_custom_subs DROP CONSTRAINT IF EXISTS %I', constraint_record.conname);
        END LOOP;
    END $$;

    ALTER TABLE licensing_custom_subs
        ADD CONSTRAINT licensing_custom_subs_status_check
        CHECK (status IN ('pending', 'active', 'paused', 'cancelled', 'past_due', 'expired', 'suspended', 'cancelling'));

    UPDATE licensing_custom_subs
    SET next_billing_date = end_date
    WHERE next_billing_date IS NULL
      AND COALESCE(auto_renew, true) = true;

    CREATE INDEX IF NOT EXISTS idx_custom_subs_next_billing ON licensing_custom_subs(next_billing_date)
    WHERE status = 'active' AND auto_renew = true;
    CREATE INDEX IF NOT EXISTS idx_custom_subs_user_status ON licensing_custom_subs(user_id, status);

    CREATE TABLE IF NOT EXISTS licensing_payment_attempts (
        id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
        subscription_id UUID NOT NULL REFERENCES licensing_custom_subs(id) ON DELETE CASCADE,
        wallet_id TEXT NOT NULL,
        card_id TEXT NOT NULL,
        amount NUMERIC(10,2) NOT NULL,
        currency VARCHAR(5) NOT NULL,
        order_id TEXT NOT NULL,
        attempt_number INTEGER DEFAULT 1,
        status TEXT NOT NULL CHECK (status IN ('success', 'failed', 'pending')),
        failure_reason TEXT,
        transaction_id TEXT,
        directpay_response JSONB,
        created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
        processed_at TIMESTAMPTZ
    );

    CREATE INDEX IF NOT EXISTS idx_payment_attempts_subscription ON licensing_payment_attempts(subscription_id, created_at DESC);
    CREATE INDEX IF NOT EXISTS idx_payment_attempts_status ON licensing_payment_attempts(status, created_at DESC);
    CREATE INDEX IF NOT EXISTS idx_payment_attempts_order_id ON licensing_payment_attempts(order_id);

    CREATE TABLE IF NOT EXISTS licensing_directpay_sessions (
        id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
        order_id TEXT NOT NULL UNIQUE,
        user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        owner_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        amount NUMERIC(10,2) NOT NULL,
        currency VARCHAR(5) NOT NULL DEFAULT 'LKR',
        status TEXT NOT NULL DEFAULT 'pending',
        request_payload JSONB,
        directpay_response JSONB,
        card_db_id UUID REFERENCES licensing_directpay_cards(id),
        payment_id UUID REFERENCES licensing_lkr_payments(id),
        created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
        processed_at TIMESTAMPTZ
    );

    CREATE INDEX IF NOT EXISTS idx_directpay_sessions_user_id ON licensing_directpay_sessions(user_id, created_at DESC);
    CREATE INDEX IF NOT EXISTS idx_directpay_sessions_status ON licensing_directpay_sessions(status, created_at DESC);
  `);
};

exports.down = pgm => {
  pgm.sql(`
    DROP TABLE IF EXISTS licensing_directpay_sessions;
    DROP INDEX IF EXISTS idx_payment_attempts_order_id;
    DROP TABLE IF EXISTS licensing_payment_attempts;
    DROP INDEX IF EXISTS idx_directpay_cards_active_default;
    DROP INDEX IF EXISTS idx_directpay_cards_user_id;
    DROP TABLE IF EXISTS licensing_directpay_cards;
  `);
};
