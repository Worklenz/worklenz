'use strict';

/**
 * Baseline gap: tables that exist in released databases but are not created by
 * database/sql/*.sql or by any earlier public migration (licensing_*,
 * task_custom_column*, finance rate-card tables). Later migrations (e.g.
 * add_plan_trials, add_lkr_pricing_tiers, client portal) assume they exist.
 *
 * Sorted before every other migration so a fresh database can run migrate:up.
 * Skipped when the tables already exist (all deployed databases).
 *
 * Triggers and functions are intentionally not created here.
 */

/** @type {import('node-pg-migrate').ColumnDefinitions | undefined} */
exports.shorthands = undefined;

/** @param {import('node-pg-migrate').MigrationBuilder} pgm */
exports.up = async (pgm) => {
  pgm.sql(`
DO $gap$
BEGIN
  IF to_regclass('licensing_plan_tiers') IS NOT NULL THEN
    RETURN;
  END IF;

  EXECUTE $sql$
CREATE TABLE finance_project_rate_card_roles (
    id uuid DEFAULT uuid_generate_v4() NOT NULL,
    project_id uuid NOT NULL,
    job_title_id uuid NOT NULL,
    rate numeric(10,2) NOT NULL,
    created_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    man_day_rate numeric(10,2) DEFAULT 0,
    CONSTRAINT finance_project_rate_card_roles_man_day_rate_check CHECK ((man_day_rate >= (0)::numeric)),
    CONSTRAINT finance_project_rate_card_roles_rate_check CHECK ((rate >= (0)::numeric))
);
COMMENT ON COLUMN finance_project_rate_card_roles.man_day_rate IS 'Rate per man day for this role in the project';
CREATE TABLE finance_rate_cards (
    id uuid DEFAULT uuid_generate_v4() NOT NULL,
    team_id uuid NOT NULL,
    name character varying NOT NULL,
    created_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    currency text DEFAULT 'LKR'::text NOT NULL
);
CREATE TABLE licensing_admin_components (
    id uuid DEFAULT uuid_generate_v4() NOT NULL,
    name text NOT NULL,
    key text NOT NULL
);
CREATE TABLE licensing_admin_user_permissions (
    admin_user_id uuid NOT NULL,
    admin_component_id uuid NOT NULL
);
CREATE TABLE licensing_appsumo_migrations (
    id uuid DEFAULT uuid_generate_v4() NOT NULL,
    organization_id uuid NOT NULL,
    coupon_code text NOT NULL,
    original_purchase_date timestamp with time zone,
    migration_offer_sent_at timestamp with time zone,
    migration_window_start timestamp with time zone,
    migration_window_end timestamp with time zone,
    discount_percentage numeric(5,2) DEFAULT 50,
    eligible_tiers text[] DEFAULT ARRAY['BUSINESS_SMALL'::text, 'BUSINESS_LARGE'::text, 'ENTERPRISE'::text],
    migration_status text DEFAULT 'pending'::text,
    migrated_to_plan_id uuid,
    migrated_at timestamp with time zone,
    decline_reason text,
    notes text,
    created_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT licensing_appsumo_migrations_migration_status_check CHECK ((migration_status = ANY (ARRAY['pending'::text, 'notified'::text, 'accepted'::text, 'declined'::text, 'expired'::text])))
);
COMMENT ON TABLE licensing_appsumo_migrations IS 'Manages AppSumo user migration offers and tracking';
CREATE TABLE licensing_custom_plan_mappings (
    id uuid DEFAULT uuid_generate_v4() NOT NULL,
    custom_sub_id uuid,
    organization_id uuid NOT NULL,
    current_monthly_value numeric(10,2),
    current_user_limit integer,
    recommended_tier text NOT NULL,
    recommended_plan_id uuid,
    price_difference numeric(10,2),
    feature_comparison jsonb,
    migration_incentive text,
    migration_status text DEFAULT 'pending'::text,
    scheduled_migration_date date,
    created_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
    reviewed_at timestamp with time zone,
    reviewed_by uuid,
    CONSTRAINT licensing_custom_plan_mappings_migration_status_check CHECK ((migration_status = ANY (ARRAY['pending'::text, 'reviewed'::text, 'accepted'::text, 'declined'::text, 'scheduled'::text])))
);
COMMENT ON TABLE licensing_custom_plan_mappings IS 'Maps custom plans to new pricing tiers with recommendations';
CREATE TABLE licensing_directpay_cards (
    id uuid DEFAULT uuid_generate_v4() NOT NULL,
    user_id uuid NOT NULL,
    card_id text NOT NULL,
    card_number_masked text NOT NULL,
    card_brand text,
    card_type text,
    expiry_month text,
    expiry_year text,
    wallet_id text,
    is_default boolean DEFAULT false,
    is_active boolean DEFAULT true,
    created_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
    last_used_at timestamp with time zone
);
COMMENT ON TABLE licensing_directpay_cards IS 'Stores tokenized DirectPay card information for recurring payments';
CREATE TABLE licensing_directpay_webhooks (
    id uuid DEFAULT uuid_generate_v4() NOT NULL,
    event_id text,
    event_type text NOT NULL,
    user_id uuid,
    subscription_id uuid,
    payment_id uuid,
    payload jsonb NOT NULL,
    processed boolean DEFAULT false,
    processed_at timestamp with time zone,
    error_message text,
    retry_count integer DEFAULT 0,
    created_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP
);
COMMENT ON TABLE licensing_directpay_webhooks IS 'Logs all DirectPay webhook events for idempotency and auditing';
CREATE TABLE licensing_lkr_payments (
    id uuid DEFAULT uuid_generate_v4() NOT NULL,
    status integer,
    card_id integer,
    card_number text,
    card_brand text,
    card_type text,
    card_issuer text,
    card_expiry_year integer,
    card_expiry_month integer,
    wallet_id text,
    transaction_id text,
    transaction_status text,
    transaction_amount numeric,
    transaction_currency text,
    transaction_channel text,
    transaction_datetime timestamp without time zone,
    transaction_message text,
    transaction_description text,
    user_id uuid NOT NULL,
    owner_id uuid NOT NULL,
    created_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
    subscription_id uuid,
    billing_type text DEFAULT 'month'::text,
    payment_type text DEFAULT 'initial'::text,
    directpay_subscription_id text,
    is_recurring boolean DEFAULT false,
    next_billing_date date,
    order_id text,
    refund_amount numeric(10,2),
    refund_reason text,
    refunded_at timestamp with time zone,
    CONSTRAINT licensing_lkr_payments_payment_type_check CHECK ((payment_type = ANY (ARRAY['initial'::text, 'recurring'::text, 'reactivation'::text])))
);
CREATE TABLE licensing_lkr_subs (
    id uuid DEFAULT uuid_generate_v4() NOT NULL,
    user_id uuid NOT NULL,
    created_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP
);
CREATE TABLE licensing_lkr_subs_log (
    id uuid DEFAULT uuid_generate_v4() NOT NULL,
    sub_id uuid NOT NULL,
    from_date date NOT NULL,
    to_date date NOT NULL,
    created_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP
);
CREATE TABLE licensing_migration_audit (
    id uuid DEFAULT uuid_generate_v4() NOT NULL,
    organization_id uuid NOT NULL,
    action_type text NOT NULL,
    actor_id uuid,
    actor_type text,
    previous_state jsonb,
    new_state jsonb,
    metadata jsonb DEFAULT '{}'::jsonb,
    ip_address inet,
    user_agent text,
    created_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT licensing_migration_audit_actor_type_check CHECK ((actor_type = ANY (ARRAY['user'::text, 'admin'::text, 'system'::text])))
);
COMMENT ON TABLE licensing_migration_audit IS 'Complete audit trail of all migration activities';
CREATE TABLE licensing_migration_discounts (
    id uuid DEFAULT uuid_generate_v4() NOT NULL,
    code text NOT NULL,
    description text,
    user_type_eligibility text[],
    plan_tier_eligibility text[],
    discount_type text,
    discount_value numeric(10,2),
    duration_months integer,
    max_redemptions integer DEFAULT 1,
    redemptions_count integer DEFAULT 0,
    valid_from timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
    valid_until timestamp with time zone,
    conditions jsonb DEFAULT '{}'::jsonb,
    is_active boolean DEFAULT true,
    created_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
    created_by uuid,
    CONSTRAINT licensing_migration_discounts_discount_type_check CHECK ((discount_type = ANY (ARRAY['percentage'::text, 'fixed_amount'::text, 'extended_trial'::text])))
);
COMMENT ON TABLE licensing_migration_discounts IS 'Promotional codes for migration incentives';
CREATE TABLE licensing_migration_eligibility (
    id uuid DEFAULT uuid_generate_v4() NOT NULL,
    organization_id uuid NOT NULL,
    current_user_type text NOT NULL,
    current_plan_id uuid,
    eligible_plans jsonb DEFAULT '[]'::jsonb NOT NULL,
    migration_window_start timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
    migration_window_end timestamp with time zone,
    discount_percentage numeric(5,2) DEFAULT 0,
    discount_duration_months integer DEFAULT 0,
    special_conditions jsonb DEFAULT '{}'::jsonb,
    is_active boolean DEFAULT true,
    created_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP
);
COMMENT ON TABLE licensing_migration_eligibility IS 'Defines migration eligibility rules and discounts for different user types';
CREATE TABLE licensing_overage_charges (
    id uuid DEFAULT uuid_generate_v4() NOT NULL,
    subscription_id uuid NOT NULL,
    billing_period_start date NOT NULL,
    billing_period_end date NOT NULL,
    overage_type text NOT NULL,
    overage_quantity integer NOT NULL,
    unit_price numeric(10,2) NOT NULL,
    total_amount numeric(10,2) NOT NULL,
    currency text DEFAULT 'USD'::text NOT NULL,
    status text DEFAULT 'pending'::text NOT NULL,
    paddle_invoice_id text,
    notes text,
    created_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
    charged_at timestamp with time zone,
    CONSTRAINT licensing_overage_charges_overage_type_check CHECK ((overage_type = ANY (ARRAY['users'::text, 'storage'::text, 'api_calls'::text]))),
    CONSTRAINT licensing_overage_charges_status_check CHECK ((status = ANY (ARRAY['pending'::text, 'invoiced'::text, 'paid'::text, 'failed'::text, 'waived'::text])))
);
COMMENT ON TABLE licensing_overage_charges IS 'Tracks additional charges for usage beyond plan limits';
CREATE TABLE licensing_paddle_webhook_events (
    id uuid DEFAULT uuid_generate_v4() NOT NULL,
    event_id text NOT NULL,
    event_type text NOT NULL,
    subscription_id text,
    user_id uuid,
    payload jsonb NOT NULL,
    processed boolean DEFAULT false,
    processed_at timestamp with time zone,
    error_message text,
    retry_count integer DEFAULT 0,
    created_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP
);
COMMENT ON TABLE licensing_paddle_webhook_events IS 'Stores and processes all Paddle webhook events for payment processing';
CREATE TABLE licensing_payment_attempts (
    id uuid DEFAULT uuid_generate_v4() NOT NULL,
    subscription_id uuid NOT NULL,
    wallet_id text NOT NULL,
    card_id text NOT NULL,
    amount numeric(10,2) NOT NULL,
    currency character varying(5) NOT NULL,
    order_id text NOT NULL,
    attempt_number integer DEFAULT 1,
    status text NOT NULL,
    failure_reason text,
    transaction_id text,
    directpay_response jsonb,
    created_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
    processed_at timestamp with time zone,
    CONSTRAINT licensing_payment_attempts_status_check CHECK ((status = ANY (ARRAY['success'::text, 'failed'::text, 'pending'::text])))
);
COMMENT ON TABLE licensing_payment_attempts IS 'Tracks payment retry attempts for failed recurring payments';
CREATE TABLE licensing_payment_gateways (
    id uuid DEFAULT uuid_generate_v4() NOT NULL,
    name text NOT NULL,
    display_name text NOT NULL,
    is_active boolean DEFAULT true,
    supports_recurring boolean DEFAULT true,
    supported_currencies text[],
    created_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP
);
COMMENT ON TABLE licensing_payment_gateways IS 'Centralized payment gateway configuration';
CREATE TABLE licensing_plan_tiers (
    id uuid DEFAULT uuid_generate_v4() NOT NULL,
    tier_name text NOT NULL,
    display_name text NOT NULL,
    tier_level integer NOT NULL,
    pricing_model text NOT NULL,
    monthly_base_price numeric(10,2) DEFAULT 0,
    annual_base_price numeric(10,2) DEFAULT 0,
    monthly_per_user_price numeric(10,2) DEFAULT 0,
    annual_per_user_price numeric(10,2) DEFAULT 0,
    min_users integer DEFAULT 1 NOT NULL,
    max_users integer,
    included_users integer DEFAULT 0,
    max_projects integer,
    max_storage_gb integer DEFAULT 5,
    max_file_size_mb integer DEFAULT 100,
    has_api_access boolean DEFAULT false,
    has_advanced_analytics boolean DEFAULT false,
    has_custom_fields boolean DEFAULT false,
    has_gantt_charts boolean DEFAULT true,
    has_time_tracking boolean DEFAULT true,
    has_resource_management boolean DEFAULT false,
    has_portfolio_view boolean DEFAULT false,
    has_custom_branding boolean DEFAULT false,
    has_sso boolean DEFAULT false,
    has_audit_logs boolean DEFAULT false,
    has_priority_support boolean DEFAULT false,
    has_dedicated_account_manager boolean DEFAULT false,
    sort_order integer DEFAULT 0 NOT NULL,
    is_popular boolean DEFAULT false,
    is_active boolean DEFAULT true,
    created_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
    trial_duration_days integer,
    trial_enabled boolean DEFAULT false,
    CONSTRAINT licensing_plan_tiers_pricing_model_check CHECK ((pricing_model = ANY (ARRAY['free'::text, 'per_user'::text, 'flat_rate_with_overage'::text, 'unlimited'::text])))
);
COMMENT ON TABLE licensing_plan_tiers IS 'Defines all subscription plan tiers with their features and pricing models';
COMMENT ON COLUMN licensing_plan_tiers.trial_duration_days IS 'Number of days for plan-specific trial (NULL means no trial available)';
COMMENT ON COLUMN licensing_plan_tiers.trial_enabled IS 'Whether trial is enabled for this plan tier';
CREATE TABLE licensing_plan_variants (
    id uuid DEFAULT uuid_generate_v4() NOT NULL,
    base_plan_id uuid,
    variant_type text,
    flat_price numeric(10,2),
    per_user_price numeric(10,2),
    user_range_min integer DEFAULT 1,
    user_range_max integer DEFAULT 100,
    paddle_product_id integer,
    active boolean DEFAULT true,
    created_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT licensing_plan_variants_variant_type_check CHECK ((variant_type = ANY (ARRAY['flat_rate'::text, 'per_user'::text])))
);
COMMENT ON TABLE licensing_plan_variants IS 'Stores different pricing variants (per-user vs flat-rate) for each plan';
COMMENT ON COLUMN licensing_plan_variants.variant_type IS 'Either per_user or flat_rate pricing model';
COMMENT ON COLUMN licensing_plan_variants.flat_price IS 'Fixed monthly price for flat-rate plans';
COMMENT ON COLUMN licensing_plan_variants.per_user_price IS 'Price per user per month for per-user plans';
COMMENT ON COLUMN licensing_plan_variants.user_range_max IS 'Maximum users allowed for this variant';
CREATE TABLE licensing_subscription_transitions (
    id uuid DEFAULT uuid_generate_v4() NOT NULL,
    subscription_id uuid NOT NULL,
    from_plan_id uuid,
    to_plan_id uuid NOT NULL,
    from_tier text,
    to_tier text NOT NULL,
    transition_type text NOT NULL,
    transition_status text DEFAULT 'pending'::text NOT NULL,
    scheduled_at timestamp with time zone,
    completed_at timestamp with time zone,
    error_message text,
    initiated_by uuid,
    paddle_transaction_id text,
    prorated_amount numeric(10,2),
    created_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT licensing_subscription_transitions_transition_status_check CHECK ((transition_status = ANY (ARRAY['pending'::text, 'processing'::text, 'completed'::text, 'failed'::text, 'cancelled'::text]))),
    CONSTRAINT licensing_subscription_transitions_transition_type_check CHECK ((transition_type = ANY (ARRAY['upgrade'::text, 'downgrade'::text, 'renewal'::text, 'switch_billing'::text])))
);
COMMENT ON TABLE licensing_subscription_transitions IS 'Tracks all plan changes and transitions for audit and billing purposes';
CREATE TABLE licensing_subscriptions (
    id uuid DEFAULT uuid_generate_v4() NOT NULL,
    user_id uuid NOT NULL,
    license_type_id uuid NOT NULL,
    is_default boolean DEFAULT false,
    valid_till_date date
);
CREATE TABLE licensing_usage_tracking (
    id uuid DEFAULT uuid_generate_v4() NOT NULL,
    organization_id uuid NOT NULL,
    subscription_id uuid,
    tracking_date date NOT NULL,
    active_users integer DEFAULT 0 NOT NULL,
    invited_users integer DEFAULT 0 NOT NULL,
    total_users integer GENERATED ALWAYS AS ((active_users + invited_users)) STORED,
    active_projects integer DEFAULT 0 NOT NULL,
    archived_projects integer DEFAULT 0 NOT NULL,
    storage_used_mb integer DEFAULT 0 NOT NULL,
    files_count integer DEFAULT 0 NOT NULL,
    tasks_created integer DEFAULT 0 NOT NULL,
    tasks_completed integer DEFAULT 0 NOT NULL,
    time_tracked_minutes integer DEFAULT 0 NOT NULL,
    created_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP
);
COMMENT ON TABLE licensing_usage_tracking IS 'Daily snapshots of usage metrics for billing and analytics';
CREATE TABLE licensing_user_payment_methods (
    user_id uuid DEFAULT uuid_generate_v4(),
    payment_method text DEFAULT 'card'::text NOT NULL,
    card_type text NOT NULL,
    last_four_digits text NOT NULL,
    expiry_date text NOT NULL,
    created_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    active boolean DEFAULT true NOT NULL
);
CREATE TABLE licensing_user_subscriptions_log (
    id uuid DEFAULT uuid_generate_v4() NOT NULL,
    user_id uuid NOT NULL,
    log_text text,
    created_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    description text,
    subscription_id uuid
);
CREATE TABLE licensing_user_type_history (
    id uuid DEFAULT uuid_generate_v4() NOT NULL,
    organization_id uuid NOT NULL,
    user_id uuid NOT NULL,
    from_type text,
    to_type text NOT NULL,
    from_plan_details jsonb,
    to_plan_details jsonb,
    migration_reason text,
    migrated_by uuid,
    created_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP
);
COMMENT ON TABLE licensing_user_type_history IS 'Tracks all user type migrations and transitions';
CREATE TABLE licensing_webhook_responses (
    id uuid DEFAULT uuid_generate_v4() NOT NULL,
    subscription_id integer NOT NULL,
    email text NOT NULL,
    response jsonb NOT NULL,
    created_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);
CREATE TABLE task_custom_column_options (
    id uuid DEFAULT uuid_generate_v4() NOT NULL,
    name text NOT NULL,
    column_id uuid NOT NULL
);
CREATE TABLE task_custom_column_values (
    task_id uuid NOT NULL,
    column_id uuid NOT NULL,
    option_id uuid NOT NULL
);
CREATE TABLE task_custom_columns (
    id uuid DEFAULT uuid_generate_v4() NOT NULL,
    name text NOT NULL,
    pinned boolean DEFAULT true NOT NULL,
    project_id uuid NOT NULL,
    team_id uuid NOT NULL
);
ALTER TABLE ONLY finance_project_rate_card_roles
    ADD CONSTRAINT finance_project_rate_card_roles_pkey PRIMARY KEY (id);
ALTER TABLE ONLY finance_rate_cards
    ADD CONSTRAINT finance_rate_cards_pkey PRIMARY KEY (id);
ALTER TABLE ONLY licensing_admin_components
    ADD CONSTRAINT licensing_admin_components_pk PRIMARY KEY (id);
ALTER TABLE ONLY licensing_appsumo_migrations
    ADD CONSTRAINT licensing_appsumo_migrations_pkey PRIMARY KEY (id);
ALTER TABLE ONLY licensing_custom_plan_mappings
    ADD CONSTRAINT licensing_custom_plan_mappings_pkey PRIMARY KEY (id);
ALTER TABLE ONLY licensing_directpay_cards
    ADD CONSTRAINT licensing_directpay_cards_pkey PRIMARY KEY (id);
ALTER TABLE ONLY licensing_directpay_cards
    ADD CONSTRAINT licensing_directpay_cards_user_id_card_id_key UNIQUE (user_id, card_id);
ALTER TABLE ONLY licensing_directpay_webhooks
    ADD CONSTRAINT licensing_directpay_webhooks_event_id_key UNIQUE (event_id);
ALTER TABLE ONLY licensing_directpay_webhooks
    ADD CONSTRAINT licensing_directpay_webhooks_pkey PRIMARY KEY (id);
ALTER TABLE ONLY licensing_lkr_payments
    ADD CONSTRAINT licensing_lkr_payments_pk PRIMARY KEY (id);
ALTER TABLE ONLY licensing_lkr_subs_log
    ADD CONSTRAINT licensing_lkr_subs_log_pk PRIMARY KEY (id);
ALTER TABLE ONLY licensing_lkr_subs
    ADD CONSTRAINT licensing_lkr_subs_pk PRIMARY KEY (id);
ALTER TABLE ONLY licensing_migration_audit
    ADD CONSTRAINT licensing_migration_audit_pkey PRIMARY KEY (id);
ALTER TABLE ONLY licensing_migration_discounts
    ADD CONSTRAINT licensing_migration_discounts_code_key UNIQUE (code);
ALTER TABLE ONLY licensing_migration_discounts
    ADD CONSTRAINT licensing_migration_discounts_pkey PRIMARY KEY (id);
ALTER TABLE ONLY licensing_migration_eligibility
    ADD CONSTRAINT licensing_migration_eligibili_organization_id_current_user__key UNIQUE (organization_id, current_user_type);
ALTER TABLE ONLY licensing_migration_eligibility
    ADD CONSTRAINT licensing_migration_eligibility_pkey PRIMARY KEY (id);
ALTER TABLE ONLY licensing_overage_charges
    ADD CONSTRAINT licensing_overage_charges_pkey PRIMARY KEY (id);
ALTER TABLE ONLY licensing_paddle_webhook_events
    ADD CONSTRAINT licensing_paddle_webhook_events_event_id_key UNIQUE (event_id);
ALTER TABLE ONLY licensing_paddle_webhook_events
    ADD CONSTRAINT licensing_paddle_webhook_events_pkey PRIMARY KEY (id);
ALTER TABLE ONLY licensing_payment_attempts
    ADD CONSTRAINT licensing_payment_attempts_pkey PRIMARY KEY (id);
ALTER TABLE ONLY licensing_payment_gateways
    ADD CONSTRAINT licensing_payment_gateways_name_key UNIQUE (name);
ALTER TABLE ONLY licensing_payment_gateways
    ADD CONSTRAINT licensing_payment_gateways_pkey PRIMARY KEY (id);
ALTER TABLE ONLY licensing_plan_tiers
    ADD CONSTRAINT licensing_plan_tiers_pkey PRIMARY KEY (id);
ALTER TABLE ONLY licensing_plan_tiers
    ADD CONSTRAINT licensing_plan_tiers_tier_level_key UNIQUE (tier_level);
ALTER TABLE ONLY licensing_plan_tiers
    ADD CONSTRAINT licensing_plan_tiers_tier_name_key UNIQUE (tier_name);
ALTER TABLE ONLY licensing_plan_variants
    ADD CONSTRAINT licensing_plan_variants_paddle_product_id_key UNIQUE (paddle_product_id);
ALTER TABLE ONLY licensing_plan_variants
    ADD CONSTRAINT licensing_plan_variants_pkey PRIMARY KEY (id);
ALTER TABLE ONLY licensing_subscription_transitions
    ADD CONSTRAINT licensing_subscription_transitions_pkey PRIMARY KEY (id);
ALTER TABLE ONLY licensing_subscriptions
    ADD CONSTRAINT licensing_subscriptions_pk PRIMARY KEY (id);
ALTER TABLE ONLY licensing_usage_tracking
    ADD CONSTRAINT licensing_usage_tracking_organization_id_tracking_date_key UNIQUE (organization_id, tracking_date);
ALTER TABLE ONLY licensing_usage_tracking
    ADD CONSTRAINT licensing_usage_tracking_pkey PRIMARY KEY (id);
ALTER TABLE ONLY licensing_user_subscriptions_log
    ADD CONSTRAINT licensing_user_subscriptions_log_pk PRIMARY KEY (id);
ALTER TABLE ONLY licensing_user_type_history
    ADD CONSTRAINT licensing_user_type_history_pkey PRIMARY KEY (id);
ALTER TABLE ONLY licensing_webhook_responses
    ADD CONSTRAINT licensing_webhook_responses_pkey PRIMARY KEY (id);
ALTER TABLE ONLY task_custom_column_options
    ADD CONSTRAINT task_custom_column_options_pk PRIMARY KEY (id);
ALTER TABLE ONLY task_custom_column_values
    ADD CONSTRAINT task_custom_column_values_pk PRIMARY KEY (task_id, column_id, option_id);
ALTER TABLE ONLY task_custom_columns
    ADD CONSTRAINT task_custom_columns_pk PRIMARY KEY (id);
ALTER TABLE ONLY finance_project_rate_card_roles
    ADD CONSTRAINT unique_project_role UNIQUE (project_id, job_title_id);
CREATE INDEX idx_directpay_cards_active_default ON licensing_directpay_cards USING btree (user_id, is_active, is_default);
CREATE INDEX idx_directpay_cards_user_id ON licensing_directpay_cards USING btree (user_id);
CREATE INDEX idx_directpay_webhooks_event_id ON licensing_directpay_webhooks USING btree (event_id);
CREATE INDEX idx_directpay_webhooks_processed ON licensing_directpay_webhooks USING btree (processed, created_at);
CREATE INDEX idx_licensing_appsumo_migrations_status ON licensing_appsumo_migrations USING btree (migration_status, migration_window_end);
CREATE INDEX idx_licensing_custom_plan_mappings_status ON licensing_custom_plan_mappings USING btree (migration_status);
CREATE INDEX idx_licensing_migration_audit_org ON licensing_migration_audit USING btree (organization_id, created_at DESC);
CREATE INDEX idx_licensing_migration_discounts_active ON licensing_migration_discounts USING btree (code) WHERE (is_active = true);
CREATE INDEX idx_licensing_migration_eligibility_org ON licensing_migration_eligibility USING btree (organization_id) WHERE (is_active = true);
CREATE INDEX idx_licensing_overage_charges_status ON licensing_overage_charges USING btree (status);
CREATE INDEX idx_licensing_overage_charges_subscription ON licensing_overage_charges USING btree (subscription_id);
CREATE INDEX idx_licensing_paddle_webhook_events_processed ON licensing_paddle_webhook_events USING btree (processed, created_at);
CREATE INDEX idx_licensing_paddle_webhook_events_subscription ON licensing_paddle_webhook_events USING btree (subscription_id);
CREATE INDEX idx_licensing_plan_tiers_active ON licensing_plan_tiers USING btree (is_active, sort_order);
CREATE INDEX idx_licensing_plan_tiers_tier_name ON licensing_plan_tiers USING btree (tier_name);
CREATE INDEX idx_licensing_plan_variants_active ON licensing_plan_variants USING btree (active);
CREATE INDEX idx_licensing_plan_variants_base_plan ON licensing_plan_variants USING btree (base_plan_id);
CREATE INDEX idx_licensing_subscription_transitions_scheduled ON licensing_subscription_transitions USING btree (scheduled_at) WHERE (transition_status = 'pending'::text);
CREATE INDEX idx_licensing_subscription_transitions_status ON licensing_subscription_transitions USING btree (transition_status);
CREATE INDEX idx_licensing_subscription_transitions_subscription ON licensing_subscription_transitions USING btree (subscription_id);
CREATE INDEX idx_licensing_usage_tracking_org_date ON licensing_usage_tracking USING btree (organization_id, tracking_date DESC);
CREATE INDEX idx_licensing_usage_tracking_subscription ON licensing_usage_tracking USING btree (subscription_id);
CREATE INDEX idx_licensing_user_type_history_org ON licensing_user_type_history USING btree (organization_id, created_at DESC);
CREATE INDEX idx_payment_attempts_status ON licensing_payment_attempts USING btree (status, created_at DESC);
CREATE INDEX idx_payment_attempts_subscription ON licensing_payment_attempts USING btree (subscription_id, created_at DESC);
CREATE UNIQUE INDEX licensing_admin_components_key_uindex ON licensing_admin_components USING btree (key);
CREATE UNIQUE INDEX licensing_admin_components_name_uindex ON licensing_admin_components USING btree (name);
CREATE UNIQUE INDEX licensing_admin_user_permissions_user_component_uindex ON licensing_admin_user_permissions USING btree (admin_user_id, admin_component_id);
CREATE UNIQUE INDEX licensing_subscriptions_one_true_default_per_user ON licensing_subscriptions USING btree (user_id) WHERE is_default;
ALTER TABLE ONLY finance_project_rate_card_roles
    ADD CONSTRAINT finance_project_rate_card_roles_job_title_id_fkey FOREIGN KEY (job_title_id) REFERENCES job_titles(id) ON DELETE CASCADE;
ALTER TABLE ONLY finance_project_rate_card_roles
    ADD CONSTRAINT finance_project_rate_card_roles_project_id_fkey FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE;
ALTER TABLE ONLY finance_rate_cards
    ADD CONSTRAINT finance_rate_cards_team_id_fkey FOREIGN KEY (team_id) REFERENCES teams(id) ON DELETE CASCADE;
ALTER TABLE ONLY licensing_admin_user_permissions
    ADD CONSTRAINT licensing_admin_user_permissions_component_id_fk FOREIGN KEY (admin_component_id) REFERENCES licensing_admin_components(id);
ALTER TABLE ONLY licensing_admin_user_permissions
    ADD CONSTRAINT licensing_admin_user_permissions_user_id_fk FOREIGN KEY (admin_user_id) REFERENCES licensing_admin_users(id);
ALTER TABLE ONLY licensing_appsumo_migrations
    ADD CONSTRAINT licensing_appsumo_migrations_migrated_to_plan_id_fkey FOREIGN KEY (migrated_to_plan_id) REFERENCES licensing_pricing_plans(id);
ALTER TABLE ONLY licensing_appsumo_migrations
    ADD CONSTRAINT licensing_appsumo_migrations_organization_id_fkey FOREIGN KEY (organization_id) REFERENCES organizations(id);
ALTER TABLE ONLY licensing_custom_plan_mappings
    ADD CONSTRAINT licensing_custom_plan_mappings_custom_sub_id_fkey FOREIGN KEY (custom_sub_id) REFERENCES licensing_custom_subs(id);
ALTER TABLE ONLY licensing_custom_plan_mappings
    ADD CONSTRAINT licensing_custom_plan_mappings_organization_id_fkey FOREIGN KEY (organization_id) REFERENCES organizations(id);
ALTER TABLE ONLY licensing_custom_plan_mappings
    ADD CONSTRAINT licensing_custom_plan_mappings_recommended_plan_id_fkey FOREIGN KEY (recommended_plan_id) REFERENCES licensing_pricing_plans(id);
ALTER TABLE ONLY licensing_custom_plan_mappings
    ADD CONSTRAINT licensing_custom_plan_mappings_reviewed_by_fkey FOREIGN KEY (reviewed_by) REFERENCES licensing_admin_users(id);
ALTER TABLE ONLY licensing_directpay_cards
    ADD CONSTRAINT licensing_directpay_cards_user_id_fkey FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE;
ALTER TABLE ONLY licensing_directpay_webhooks
    ADD CONSTRAINT licensing_directpay_webhooks_subscription_id_fkey FOREIGN KEY (subscription_id) REFERENCES licensing_custom_subs(id);
ALTER TABLE ONLY licensing_directpay_webhooks
    ADD CONSTRAINT licensing_directpay_webhooks_user_id_fkey FOREIGN KEY (user_id) REFERENCES users(id);
ALTER TABLE ONLY licensing_lkr_payments
    ADD CONSTRAINT licensing_lkr_payments_subscription_id_fkey FOREIGN KEY (subscription_id) REFERENCES licensing_custom_subs(id);
ALTER TABLE ONLY licensing_lkr_payments
    ADD CONSTRAINT licensing_lkr_payments_users_id_fk FOREIGN KEY (owner_id) REFERENCES users(id);
ALTER TABLE ONLY licensing_lkr_payments
    ADD CONSTRAINT licensing_lkr_payments_users_id_fk_2 FOREIGN KEY (user_id) REFERENCES users(id);
ALTER TABLE ONLY licensing_lkr_subs_log
    ADD CONSTRAINT licensing_lkr_subs_log_sub_id_fk FOREIGN KEY (sub_id) REFERENCES licensing_lkr_subs(id);
ALTER TABLE ONLY licensing_lkr_subs
    ADD CONSTRAINT licensing_lkr_subs_user_id_fk FOREIGN KEY (user_id) REFERENCES users(id);
ALTER TABLE ONLY licensing_migration_audit
    ADD CONSTRAINT licensing_migration_audit_actor_id_fkey FOREIGN KEY (actor_id) REFERENCES users(id);
ALTER TABLE ONLY licensing_migration_audit
    ADD CONSTRAINT licensing_migration_audit_organization_id_fkey FOREIGN KEY (organization_id) REFERENCES organizations(id);
ALTER TABLE ONLY licensing_migration_discounts
    ADD CONSTRAINT licensing_migration_discounts_created_by_fkey FOREIGN KEY (created_by) REFERENCES licensing_admin_users(id);
ALTER TABLE ONLY licensing_migration_eligibility
    ADD CONSTRAINT licensing_migration_eligibility_current_plan_id_fkey FOREIGN KEY (current_plan_id) REFERENCES licensing_pricing_plans(id);
ALTER TABLE ONLY licensing_migration_eligibility
    ADD CONSTRAINT licensing_migration_eligibility_organization_id_fkey FOREIGN KEY (organization_id) REFERENCES organizations(id);
ALTER TABLE ONLY licensing_overage_charges
    ADD CONSTRAINT licensing_overage_charges_subscription_id_fkey FOREIGN KEY (subscription_id) REFERENCES licensing_user_subscriptions(id);
ALTER TABLE ONLY licensing_paddle_webhook_events
    ADD CONSTRAINT licensing_paddle_webhook_events_user_id_fkey FOREIGN KEY (user_id) REFERENCES users(id);
ALTER TABLE ONLY licensing_payment_attempts
    ADD CONSTRAINT licensing_payment_attempts_subscription_id_fkey FOREIGN KEY (subscription_id) REFERENCES licensing_custom_subs(id) ON DELETE CASCADE;
ALTER TABLE ONLY licensing_plan_variants
    ADD CONSTRAINT licensing_plan_variants_base_plan_id_fkey FOREIGN KEY (base_plan_id) REFERENCES licensing_pricing_plans(id) ON DELETE CASCADE;
ALTER TABLE ONLY licensing_subscription_transitions
    ADD CONSTRAINT licensing_subscription_transitions_from_plan_id_fkey FOREIGN KEY (from_plan_id) REFERENCES licensing_pricing_plans(id);
ALTER TABLE ONLY licensing_subscription_transitions
    ADD CONSTRAINT licensing_subscription_transitions_initiated_by_fkey FOREIGN KEY (initiated_by) REFERENCES users(id);
ALTER TABLE ONLY licensing_subscription_transitions
    ADD CONSTRAINT licensing_subscription_transitions_subscription_id_fkey FOREIGN KEY (subscription_id) REFERENCES licensing_user_subscriptions(id);
ALTER TABLE ONLY licensing_subscription_transitions
    ADD CONSTRAINT licensing_subscription_transitions_to_plan_id_fkey FOREIGN KEY (to_plan_id) REFERENCES licensing_pricing_plans(id);
ALTER TABLE ONLY licensing_subscriptions
    ADD CONSTRAINT licensing_subscriptions_user_id_fk FOREIGN KEY (user_id) REFERENCES users(id);
ALTER TABLE ONLY licensing_usage_tracking
    ADD CONSTRAINT licensing_usage_tracking_organization_id_fkey FOREIGN KEY (organization_id) REFERENCES organizations(id);
ALTER TABLE ONLY licensing_usage_tracking
    ADD CONSTRAINT licensing_usage_tracking_subscription_id_fkey FOREIGN KEY (subscription_id) REFERENCES licensing_user_subscriptions(id);
ALTER TABLE ONLY licensing_user_payment_methods
    ADD CONSTRAINT licensing_user_payment_methods_users_id_fk FOREIGN KEY (user_id) REFERENCES users(id);
ALTER TABLE ONLY licensing_user_subscriptions_log
    ADD CONSTRAINT licensing_user_subs_log_licensing_user_subs_id_fk FOREIGN KEY (subscription_id) REFERENCES licensing_user_subscriptions(id) ON DELETE CASCADE;
ALTER TABLE ONLY licensing_user_subscriptions_log
    ADD CONSTRAINT licensing_user_subscriptions_log_users_id_fk FOREIGN KEY (user_id) REFERENCES users(id);
ALTER TABLE ONLY licensing_user_type_history
    ADD CONSTRAINT licensing_user_type_history_migrated_by_fkey FOREIGN KEY (migrated_by) REFERENCES users(id);
ALTER TABLE ONLY licensing_user_type_history
    ADD CONSTRAINT licensing_user_type_history_organization_id_fkey FOREIGN KEY (organization_id) REFERENCES organizations(id);
ALTER TABLE ONLY licensing_user_type_history
    ADD CONSTRAINT licensing_user_type_history_user_id_fkey FOREIGN KEY (user_id) REFERENCES users(id);
ALTER TABLE ONLY task_custom_column_options
    ADD CONSTRAINT task_custom_column_options_column_id_fk FOREIGN KEY (column_id) REFERENCES task_custom_columns(id) ON DELETE CASCADE;
ALTER TABLE ONLY task_custom_column_values
    ADD CONSTRAINT task_custom_column_values_column_id_fk FOREIGN KEY (column_id) REFERENCES task_custom_columns(id) ON DELETE CASCADE;
ALTER TABLE ONLY task_custom_column_values
    ADD CONSTRAINT task_custom_column_values_option_id_fk FOREIGN KEY (option_id) REFERENCES task_custom_column_options(id) ON DELETE CASCADE;
ALTER TABLE ONLY task_custom_column_values
    ADD CONSTRAINT task_custom_column_values_task_id_fk FOREIGN KEY (task_id) REFERENCES tasks(id) ON DELETE CASCADE;
ALTER TABLE ONLY task_custom_columns
    ADD CONSTRAINT task_custom_columns_project_id_fk FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE;
ALTER TABLE ONLY task_custom_columns
    ADD CONSTRAINT task_custom_columns_team_id_fk FOREIGN KEY (team_id) REFERENCES teams(id);

  $sql$;
END
$gap$;
`);
  pgm.sql(`
CREATE TABLE IF NOT EXISTS licensing_custom_plan_pricing (
    id uuid DEFAULT uuid_generate_v4() PRIMARY KEY,
    tier_name text NOT NULL,
    tier_level integer NOT NULL,
    display_name text NOT NULL,
    monthly_base_price numeric(10,2) NOT NULL,
    annual_base_price numeric(10,2) NOT NULL,
    currency text DEFAULT 'LKR',
    included_users integer NOT NULL,
    max_users integer,
    monthly_per_user_price numeric(10,2),
    annual_per_user_price numeric(10,2),
    features jsonb,
    is_active boolean DEFAULT true,
    created_at timestamptz DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamptz DEFAULT CURRENT_TIMESTAMP,
    sort_order integer DEFAULT 0,
    CONSTRAINT licensing_custom_plan_pricing_tier_name_currency_key UNIQUE (tier_name, currency)
);

ALTER TABLE licensing_custom_subs ADD COLUMN IF NOT EXISTS plan_tier_id uuid;
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'licensing_custom_subs_plan_tier_id_fkey') THEN
        ALTER TABLE licensing_custom_subs
            ADD CONSTRAINT licensing_custom_subs_plan_tier_id_fkey
            FOREIGN KEY (plan_tier_id) REFERENCES licensing_custom_plan_pricing(id);
    END IF;
END $$;

-- Columns present in released databases but absent from the base schema
ALTER TABLE licensing_custom_subs ADD COLUMN IF NOT EXISTS payment_gateway_id uuid;
ALTER TABLE licensing_custom_subs ADD COLUMN IF NOT EXISTS status text DEFAULT 'active'::text;
ALTER TABLE licensing_custom_subs ADD COLUMN IF NOT EXISTS next_billing_date date;
ALTER TABLE licensing_custom_subs ADD COLUMN IF NOT EXISTS last_payment_date date;
ALTER TABLE licensing_custom_subs ADD COLUMN IF NOT EXISTS auto_renew boolean DEFAULT true;
ALTER TABLE licensing_custom_subs ADD COLUMN IF NOT EXISTS directpay_subscription_id text;
ALTER TABLE licensing_custom_subs ADD COLUMN IF NOT EXISTS card_id uuid;
ALTER TABLE licensing_custom_subs ADD COLUMN IF NOT EXISTS cancellation_reason text;
ALTER TABLE licensing_custom_subs ADD COLUMN IF NOT EXISTS cancelled_at timestamp with time zone;
ALTER TABLE licensing_custom_subs ADD COLUMN IF NOT EXISTS retry_count integer DEFAULT 0;
ALTER TABLE licensing_custom_subs ADD COLUMN IF NOT EXISTS last_retry_at timestamp with time zone;
ALTER TABLE licensing_custom_subs ADD COLUMN IF NOT EXISTS next_retry_date date;
ALTER TABLE licensing_custom_subs ADD COLUMN IF NOT EXISTS grace_period_ends date;
ALTER TABLE licensing_pricing_plans ADD COLUMN IF NOT EXISTS pricing_model text DEFAULT 'per_user'::text;
ALTER TABLE licensing_pricing_plans ADD COLUMN IF NOT EXISTS max_users integer;
ALTER TABLE licensing_pricing_plans ADD COLUMN IF NOT EXISTS min_users integer DEFAULT 1;
ALTER TABLE licensing_pricing_plans ADD COLUMN IF NOT EXISTS flat_rate_price numeric DEFAULT NULL::numeric;
ALTER TABLE licensing_pricing_plans ADD COLUMN IF NOT EXISTS tier_id uuid;
ALTER TABLE licensing_pricing_plans ADD COLUMN IF NOT EXISTS is_custom_pricing boolean DEFAULT false;
ALTER TABLE licensing_pricing_plans ADD COLUMN IF NOT EXISTS discount_percentage numeric DEFAULT 0;
ALTER TABLE licensing_pricing_plans ADD COLUMN IF NOT EXISTS created_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP;
ALTER TABLE licensing_pricing_plans ADD COLUMN IF NOT EXISTS updated_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP;
ALTER TABLE licensing_pricing_plans ADD COLUMN IF NOT EXISTS description text;
ALTER TABLE licensing_user_subscriptions ADD COLUMN IF NOT EXISTS pricing_model text DEFAULT 'per_user'::text;
ALTER TABLE licensing_user_subscriptions ADD COLUMN IF NOT EXISTS actual_users integer;
ALTER TABLE licensing_user_subscriptions ADD COLUMN IF NOT EXISTS flat_rate_max_users integer;
ALTER TABLE sys_license_types ADD COLUMN IF NOT EXISTS created_at timestamp with time zone DEFAULT now();
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'licensing_custom_subs_payment_gateway_id_fkey') THEN
        ALTER TABLE licensing_custom_subs ADD CONSTRAINT licensing_custom_subs_payment_gateway_id_fkey
            FOREIGN KEY (payment_gateway_id) REFERENCES licensing_payment_gateways(id);
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'licensing_custom_subs_card_id_fkey') THEN
        ALTER TABLE licensing_custom_subs ADD CONSTRAINT licensing_custom_subs_card_id_fkey
            FOREIGN KEY (card_id) REFERENCES licensing_directpay_cards(id);
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'licensing_pricing_plans_tier_id_fkey') THEN
        ALTER TABLE licensing_pricing_plans ADD CONSTRAINT licensing_pricing_plans_tier_id_fkey
            FOREIGN KEY (tier_id) REFERENCES licensing_plan_tiers(id);
    END IF;
END $$;

-- Finance, org billing and misc columns present in released databases but absent from the base schema
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'calculation_method_type') THEN
        CREATE TYPE calculation_method_type AS ENUM ('hourly', 'man_days');
    END IF;
END $$;

ALTER TABLE organizations ADD COLUMN IF NOT EXISTS calculation_method calculation_method_type DEFAULT 'hourly'::calculation_method_type NOT NULL;
ALTER TABLE organizations ADD COLUMN IF NOT EXISTS hours_per_day numeric(4,2) DEFAULT 8.0;
ALTER TABLE organizations ADD COLUMN IF NOT EXISTS user_type text DEFAULT 'free'::text;
ALTER TABLE organizations ADD COLUMN IF NOT EXISTS user_type_metadata jsonb DEFAULT '{}'::jsonb;
ALTER TABLE organizations ADD COLUMN IF NOT EXISTS migration_eligible boolean DEFAULT true;
ALTER TABLE organizations ADD COLUMN IF NOT EXISTS migration_deadline timestamp with time zone;
ALTER TABLE organizations ADD COLUMN IF NOT EXISTS preferred_payment_gateway_id uuid;
ALTER TABLE project_members ADD COLUMN IF NOT EXISTS project_rate_card_role_id uuid;
ALTER TABLE projects ADD COLUMN IF NOT EXISTS rate_card uuid;
ALTER TABLE projects ADD COLUMN IF NOT EXISTS currency varchar(3) DEFAULT 'USD'::character varying;
ALTER TABLE projects ADD COLUMN IF NOT EXISTS budget numeric(15,2) DEFAULT 0 NOT NULL;
ALTER TABLE projects ADD COLUMN IF NOT EXISTS calculation_method calculation_method_type DEFAULT 'hourly'::calculation_method_type NOT NULL;
ALTER TABLE projects ADD COLUMN IF NOT EXISTS hours_per_day_finance numeric(4,2) DEFAULT 8.0 NOT NULL;
ALTER TABLE projects ADD COLUMN IF NOT EXISTS worklend_id text;
ALTER TABLE projects ADD COLUMN IF NOT EXISTS project_number integer;
ALTER TABLE projects ADD COLUMN IF NOT EXISTS worklenz_id text;
ALTER TABLE tasks ADD COLUMN IF NOT EXISTS fixed_cost numeric DEFAULT 0;
ALTER TABLE team_members ADD COLUMN IF NOT EXISTS country_code char(2) DEFAULT NULL::bpchar;
ALTER TABLE teams ADD COLUMN IF NOT EXISTS status varchar(20) DEFAULT 'active'::character varying;
ALTER TABLE users ADD COLUMN IF NOT EXISTS is_admin boolean DEFAULT false;
ALTER TABLE users_data ADD COLUMN IF NOT EXISTS custom_plan boolean DEFAULT false;

DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'projects_rate_card_fkey' AND conrelid = 'projects'::regclass) THEN
        ALTER TABLE projects ADD CONSTRAINT projects_rate_card_fkey FOREIGN KEY (rate_card) REFERENCES finance_rate_cards(id) ON DELETE SET NULL;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'organizations_preferred_payment_gateway_id_fkey' AND conrelid = 'organizations'::regclass) THEN
        ALTER TABLE organizations ADD CONSTRAINT organizations_preferred_payment_gateway_id_fkey FOREIGN KEY (preferred_payment_gateway_id) REFERENCES licensing_payment_gateways(id);
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'project_members_project_rate_card_role_id_fkey' AND conrelid = 'project_members'::regclass) THEN
        ALTER TABLE project_members ADD CONSTRAINT project_members_project_rate_card_role_id_fkey FOREIGN KEY (project_rate_card_role_id) REFERENCES finance_project_rate_card_roles(id) ON DELETE SET NULL;
    END IF;
END $$;

-- Converted to progress_mode_type by 1745712001000_update_progress_mode_handlers
ALTER TABLE tasks ADD COLUMN IF NOT EXISTS progress_mode text;
  `);
};

// Intentionally irreversible: these tables belong to deployed databases that
// never ran this migration, so dropping them would be destructive.
exports.down = () => {};
