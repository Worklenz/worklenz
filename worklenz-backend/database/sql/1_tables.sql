-- Domains
CREATE DOMAIN WL_HEX_COLOR AS TEXT CHECK (value ~* '^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$');
CREATE DOMAIN WL_EMAIL AS TEXT CHECK (value ~* '^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$');

-- Enumerated Types
-- Add new values using "ALTER TYPE WL_TASK_LIST_COL_KEY ADD VALUE 'NEW_VALUE_NAME' AFTER 'REPORTER';"
CREATE TYPE WL_TASK_LIST_COL_KEY AS ENUM ('ASSIGNEES', 'COMPLETED_DATE', 'CREATED_DATE', 'DESCRIPTION', 'DUE_DATE', 'ESTIMATION', 'KEY', 'LABELS', 'LAST_UPDATED', 'NAME', 'PRIORITY', 'PROGRESS', 'START_DATE', 'STATUS', 'TIME_TRACKING', 'REPORTER', 'PHASE');

CREATE TYPE REACTION_TYPES AS ENUM ('like');

CREATE TYPE DEPENDENCY_TYPE AS ENUM ('blocked_by');

CREATE TYPE SCHEDULE_TYPE AS ENUM ('daily', 'weekly', 'yearly', 'monthly', 'every_x_days', 'every_x_weeks', 'every_x_months');

CREATE TYPE LANGUAGE_TYPE AS ENUM ('en', 'es', 'pt', 'alb', 'de', 'zh_cn');

-- START: Users
CREATE SEQUENCE IF NOT EXISTS users_user_no_seq START 1;

-- Utility and referenced tables
-- Create sessions table for connect-pg-simple session store
CREATE TABLE IF NOT EXISTS pg_sessions (
    sid    VARCHAR      NOT NULL        PRIMARY KEY,
    sess   JSON         NOT NULL,
    expire TIMESTAMP(6) NOT NULL
);

CREATE TABLE IF NOT EXISTS project_access_levels (
    id   UUID DEFAULT uuid_generate_v4() NOT NULL,
    name TEXT                            NOT NULL,
    key  TEXT                            NOT NULL
);

ALTER TABLE project_access_levels
    ADD CONSTRAINT project_access_levels_pk
        PRIMARY KEY (id);
        
CREATE TABLE IF NOT EXISTS countries (
    id       UUID       DEFAULT uuid_generate_v4() NOT NULL,
    code     CHAR(2)                               NOT NULL,
    name     VARCHAR(150)                          NOT NULL,
    phone    INTEGER                               NOT NULL,
    currency VARCHAR(3) DEFAULT NULL::CHARACTER VARYING
);

ALTER TABLE countries
    ADD PRIMARY KEY (id);

CREATE TABLE IF NOT EXISTS permissions (
    id          TEXT NOT NULL,
    name        TEXT NOT NULL,
    description TEXT NOT NULL
);

ALTER TABLE permissions
    ADD CONSTRAINT permissions_pk
        PRIMARY KEY (id);

CREATE TABLE IF NOT EXISTS archived_projects (
    user_id    UUID NOT NULL,
    project_id UUID NOT NULL
);

ALTER TABLE archived_projects
    ADD CONSTRAINT archived_projects_pk
        PRIMARY KEY (user_id, project_id);

CREATE TABLE IF NOT EXISTS bounced_emails (
    id         UUID                     DEFAULT uuid_generate_v4() NOT NULL,
    email      TEXT                                                NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP  NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP  NOT NULL
);

ALTER TABLE bounced_emails
    ADD CONSTRAINT bounced_emails_pk
        PRIMARY KEY (id);

CREATE TABLE IF NOT EXISTS clients (
    id         UUID                     DEFAULT uuid_generate_v4() NOT NULL,
    name       TEXT                                                NOT NULL,
    team_id    UUID                                                NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP  NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP  NOT NULL
);

ALTER TABLE clients
    ADD CONSTRAINT clients_pk
        PRIMARY KEY (id);

ALTER TABLE clients
    ADD CONSTRAINT clients_name_check
        CHECK (CHAR_LENGTH(name) <= 60);

CREATE TABLE IF NOT EXISTS cpt_phases (
    id          UUID                     DEFAULT uuid_generate_v4() NOT NULL,
    name        TEXT                                                NOT NULL,
    color_code  WL_HEX_COLOR                                        NOT NULL,
    template_id UUID                                                NOT NULL,
    created_at  TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP  NOT NULL
);

ALTER TABLE cpt_phases
    ADD CONSTRAINT cpt_phases_pk
        PRIMARY KEY (id);

CREATE TABLE IF NOT EXISTS cpt_task_labels (
    task_id  UUID NOT NULL,
    label_id UUID NOT NULL
);

ALTER TABLE cpt_task_labels
    ADD CONSTRAINT cpt_task_labels_pk
        PRIMARY KEY (task_id, label_id);

CREATE TABLE IF NOT EXISTS cpt_task_phases (
    task_id  UUID NOT NULL,
    phase_id UUID NOT NULL
);

ALTER TABLE cpt_task_phases
    ADD CONSTRAINT cpt_task_phase_phase_id_fk
        FOREIGN KEY (phase_id) REFERENCES cpt_phases
            ON DELETE CASCADE;

CREATE TABLE IF NOT EXISTS cpt_task_statuses (
    id          UUID    DEFAULT uuid_generate_v4() NOT NULL,
    name        TEXT                               NOT NULL,
    template_id UUID                               NOT NULL,
    team_id     UUID                               NOT NULL,
    category_id UUID                               NOT NULL,
    sort_order  INTEGER DEFAULT 0                  NOT NULL
);

ALTER TABLE cpt_task_statuses
    ADD CONSTRAINT cpt_task_statuses_pk
        PRIMARY KEY (id);

CREATE TABLE IF NOT EXISTS cpt_tasks (
    id               UUID                     DEFAULT uuid_generate_v4() NOT NULL,
    name             TEXT                                                NOT NULL,
    description      TEXT,
    total_minutes    NUMERIC                  DEFAULT 0                  NOT NULL,
    sort_order       INTEGER                  DEFAULT 0                  NOT NULL,
    task_no          BIGINT,
    original_task_id UUID,
    priority_id      UUID                                                NOT NULL,
    template_id      UUID                                                NOT NULL,
    parent_task_id   UUID,
    status_id        UUID                                                NOT NULL,
    created_at       TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP  NOT NULL,
    updated_at       TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP  NOT NULL
);

COMMENT ON COLUMN cpt_tasks.original_task_id IS 'original_task_id from the project the template is created from';

ALTER TABLE cpt_tasks
    ADD CONSTRAINT cpt_tasks_pk
        PRIMARY KEY (id);

ALTER TABLE cpt_task_labels
    ADD CONSTRAINT cpt_task_labels_task_id_fk
        FOREIGN KEY (task_id) REFERENCES cpt_tasks
            ON DELETE CASCADE;

ALTER TABLE cpt_task_phases
    ADD CONSTRAINT cpt_task_phase_task_id_fk
        FOREIGN KEY (task_id) REFERENCES cpt_tasks
            ON DELETE CASCADE;

ALTER TABLE cpt_tasks
    ADD CONSTRAINT cpt_tasks_sort_order_unique
        UNIQUE (template_id, sort_order)
            DEFERRABLE INITIALLY DEFERRED;

ALTER TABLE cpt_tasks
    ADD CONSTRAINT cpt_tasks_status_id_fk
        FOREIGN KEY (status_id) REFERENCES cpt_task_statuses
            ON DELETE RESTRICT;

ALTER TABLE cpt_tasks
    ADD CONSTRAINT cpt_tasks_task_order_check
        CHECK (sort_order >= 0);

ALTER TABLE cpt_tasks
    ADD CONSTRAINT cpt_tasks_total_minutes_check
        CHECK ((total_minutes >= (0)::NUMERIC) AND (total_minutes <= (999999)::NUMERIC));

CREATE TABLE IF NOT EXISTS custom_project_templates (
    id          UUID                     DEFAULT uuid_generate_v4() NOT NULL,
    name        TEXT                                                NOT NULL,
    phase_label TEXT                     DEFAULT 'Phase'::TEXT      NOT NULL,
    team_id     UUID                                                NOT NULL,
    created_at  TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP  NOT NULL,
    updated_at  TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP  NOT NULL,
    color_code  TEXT                                                NOT NULL,
    notes       TEXT
);

ALTER TABLE custom_project_templates
    ADD CONSTRAINT custom_project_templates_pk
        PRIMARY KEY (id);

ALTER TABLE cpt_phases
    ADD CONSTRAINT cpt_phases_template_id_fk
        FOREIGN KEY (template_id) REFERENCES custom_project_templates
            ON DELETE CASCADE;

ALTER TABLE cpt_task_statuses
    ADD CONSTRAINT cpt_task_statuses_template_id_fk
        FOREIGN KEY (template_id) REFERENCES custom_project_templates
            ON DELETE CASCADE;

ALTER TABLE cpt_tasks
    ADD CONSTRAINT cpt_tasks_template_fk
        FOREIGN KEY (template_id) REFERENCES custom_project_templates
            ON DELETE CASCADE;

CREATE OR REPLACE FUNCTION lower_email() RETURNS trigger
    LANGUAGE plpgsql
AS
$$
DECLARE
BEGIN

    IF (is_null_or_empty(NEW.email) IS FALSE)
    THEN
        NEW.email = LOWER(TRIM(NEW.email));
    END IF;

    RETURN NEW;
END
$$;

CREATE TABLE IF NOT EXISTS email_invitations (
    id             UUID                     DEFAULT uuid_generate_v4() NOT NULL,
    name           TEXT                                                NOT NULL,
    email          WL_EMAIL                                            NOT NULL,
    team_id        UUID,
    team_member_id UUID,
    created_at     TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP  NOT NULL,
    updated_at     TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP  NOT NULL
);

ALTER TABLE email_invitations
    ADD CONSTRAINT email_invitations_pk
        PRIMARY KEY (id);

CREATE TABLE IF NOT EXISTS favorite_projects (
    user_id    UUID NOT NULL,
    project_id UUID NOT NULL
);

ALTER TABLE favorite_projects
    ADD CONSTRAINT favorite_projects_pk
        PRIMARY KEY (user_id, project_id);

CREATE TABLE IF NOT EXISTS job_titles (
    id      UUID DEFAULT uuid_generate_v4() NOT NULL,
    name    TEXT                            NOT NULL,
    team_id UUID                            NOT NULL
);

ALTER TABLE job_titles
    ADD CONSTRAINT job_titles_pk
        PRIMARY KEY (id);

ALTER TABLE job_titles
    ADD CONSTRAINT job_titles_name_check
        CHECK (CHAR_LENGTH(name) <= 55);

CREATE TABLE IF NOT EXISTS licensing_admin_users (
    id         UUID    DEFAULT uuid_generate_v4() NOT NULL,
    name       TEXT                               NOT NULL,
    username   TEXT                               NOT NULL,
    phone_no   TEXT                               NOT NULL,
    otp        TEXT,
    otp_expiry TIMESTAMP WITH TIME ZONE,
    active     BOOLEAN DEFAULT TRUE               NOT NULL
);

ALTER TABLE licensing_admin_users
    ADD CONSTRAINT licensing_admin_users_id_pk
        PRIMARY KEY (id);

CREATE TABLE IF NOT EXISTS licensing_app_sumo_batches (
    id         UUID                     DEFAULT uuid_generate_v4() NOT NULL,
    name       TEXT                                                NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    created_by UUID                                                NOT NULL
);

ALTER TABLE licensing_app_sumo_batches
    ADD CONSTRAINT licensing_app_sumo_batches_pk
        PRIMARY KEY (id);

ALTER TABLE licensing_app_sumo_batches
    ADD CONSTRAINT licensing_app_sumo_batches_created_by_fk
        FOREIGN KEY (created_by) REFERENCES licensing_admin_users;

CREATE TABLE IF NOT EXISTS licensing_coupon_codes (
    id                 UUID                     DEFAULT uuid_generate_v4() NOT NULL,
    coupon_code        TEXT                                                NOT NULL,
    is_redeemed        BOOLEAN                  DEFAULT FALSE,
    is_app_sumo        BOOLEAN                  DEFAULT FALSE,
    projects_limit     INTEGER,
    team_members_limit INTEGER                  DEFAULT 3,
    storage_limit      INTEGER                  DEFAULT 5,
    redeemed_by        UUID,
    batch_id           UUID,
    created_by         UUID                                                NOT NULL,
    created_at         TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    redeemed_at        TIMESTAMP WITH TIME ZONE,
    is_refunded        BOOLEAN                  DEFAULT FALSE,
    reason             TEXT,
    feedback           TEXT,
    refunded_at        TIMESTAMP WITH TIME ZONE
);

ALTER TABLE licensing_coupon_codes
    ADD CONSTRAINT licensing_coupon_codes_pk
        PRIMARY KEY (id);

ALTER TABLE licensing_coupon_codes
    ADD CONSTRAINT licensing_coupon_codes_created_by_fk
        FOREIGN KEY (created_by) REFERENCES licensing_admin_users;

CREATE TABLE IF NOT EXISTS licensing_credit_subs (
    id             UUID                     DEFAULT uuid_generate_v4() NOT NULL,
    next_plan_id   UUID                                                NOT NULL,
    user_id        UUID                                                NOT NULL,
    credit_given   NUMERIC                                             NOT NULL,
    created_at     TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP  NOT NULL,
    created_by     UUID                                                NOT NULL,
    checkout_url   TEXT,
    credit_balance NUMERIC                  DEFAULT 0
);

ALTER TABLE licensing_credit_subs
    ADD CONSTRAINT licensing_credit_subs_pk
        PRIMARY KEY (id);

ALTER TABLE licensing_credit_subs
    ADD CONSTRAINT licensing_credit_subs_created_by_fk
        FOREIGN KEY (created_by) REFERENCES licensing_admin_users;

CREATE TABLE IF NOT EXISTS licensing_custom_subs (
    id           UUID                     DEFAULT uuid_generate_v4()        NOT NULL,
    user_id      UUID                                                       NOT NULL,
    billing_type TEXT                     DEFAULT 'year'::CHARACTER VARYING NOT NULL,
    currency     TEXT                     DEFAULT 'LKR'::CHARACTER VARYING  NOT NULL,
    rate         NUMERIC                  DEFAULT 0                         NOT NULL,
    created_at   TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP         NOT NULL,
    end_date     DATE                                                       NOT NULL,
    user_limit   INTEGER
);

ALTER TABLE licensing_custom_subs
    ADD PRIMARY KEY (id);

CREATE TABLE IF NOT EXISTS licensing_custom_subs_logs (
    id              UUID                     DEFAULT uuid_generate_v4() NOT NULL,
    subscription_id UUID                                                NOT NULL,
    log_text        TEXT                                                NOT NULL,
    description     TEXT,
    admin_user_id   UUID                                                NOT NULL,
    created_at      TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP  NOT NULL
);

ALTER TABLE licensing_custom_subs_logs
    ADD PRIMARY KEY (id);

ALTER TABLE licensing_custom_subs_logs
    ADD CONSTRAINT licensing_custom_subs_logs_licensing_admin_users_id_fk
        FOREIGN KEY (admin_user_id) REFERENCES licensing_admin_users;

CREATE TABLE IF NOT EXISTS licensing_payment_details (
    id                      UUID                     DEFAULT uuid_generate_v4() NOT NULL,
    user_id                 UUID,
    alert_id                TEXT                                                NOT NULL,
    alert_name              TEXT                                                NOT NULL,
    balance_currency        TEXT                     DEFAULT 'USD'::TEXT,
    balance_earnings        NUMERIC                  DEFAULT 0                  NOT NULL,
    balance_fee             NUMERIC                  DEFAULT 0                  NOT NULL,
    balance_gross           NUMERIC                  DEFAULT 0                  NOT NULL,
    balance_tax             NUMERIC                  DEFAULT 0                  NOT NULL,
    checkout_id             TEXT                                                NOT NULL,
    country                 TEXT                                                NOT NULL,
    coupon                  TEXT                                                NOT NULL,
    currency                TEXT                     DEFAULT 'USD'::TEXT        NOT NULL,
    custom_data             TEXT,
    customer_name           TEXT                                                NOT NULL,
    earnings                NUMERIC                  DEFAULT 0                  NOT NULL,
    email                   TEXT                                                NOT NULL,
    event_time              TEXT                                                NOT NULL,
    fee                     NUMERIC                  DEFAULT 0                  NOT NULL,
    initial_payment         NUMERIC                  DEFAULT 1                  NOT NULL,
    instalments             NUMERIC                  DEFAULT 1                  NOT NULL,
    marketing_consent       INTEGER                  DEFAULT 0,
    next_bill_date          DATE                                                NOT NULL,
    next_payment_amount     NUMERIC                  DEFAULT 0                  NOT NULL,
    order_id                TEXT                                                NOT NULL,
    p_signature             TEXT                                                NOT NULL,
    passthrough             TEXT,
    payment_method          TEXT                     DEFAULT 'card'::TEXT       NOT NULL,
    payment_tax             NUMERIC                  DEFAULT 0,
    plan_name               TEXT                                                NOT NULL,
    quantity                NUMERIC                  DEFAULT 0                  NOT NULL,
    receipt_url             TEXT                                                NOT NULL,
    sale_gross              TEXT                     DEFAULT 0                  NOT NULL,
    status                  TEXT                                                NOT NULL,
    subscription_id         TEXT                                                NOT NULL,
    subscription_payment_id TEXT                                                NOT NULL,
    subscription_plan_id    INTEGER,
    unit_price              NUMERIC                  DEFAULT 0                  NOT NULL,
    paddle_user_id          TEXT                                                NOT NULL,
    created_at              TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP  NOT NULL,
    payment_status          TEXT                     DEFAULT 'success'::TEXT    NOT NULL
);

ALTER TABLE licensing_payment_details
    ADD PRIMARY KEY (id);

CREATE TABLE IF NOT EXISTS licensing_pricing_plans (
    id               UUID    DEFAULT uuid_generate_v4() NOT NULL,
    name             TEXT    DEFAULT ''::TEXT           NOT NULL,
    billing_type     TEXT    DEFAULT 'month'::TEXT      NOT NULL,
    billing_period   INTEGER DEFAULT 1                  NOT NULL,
    default_currency TEXT    DEFAULT 'USD'::TEXT        NOT NULL,
    initial_price    TEXT    DEFAULT '0'::TEXT          NOT NULL,
    recurring_price  TEXT    DEFAULT '0'::TEXT          NOT NULL,
    trial_days       INTEGER DEFAULT 0                  NOT NULL,
    paddle_id        INTEGER DEFAULT 0,
    active           BOOLEAN DEFAULT FALSE              NOT NULL,
    is_startup_plan  BOOLEAN DEFAULT FALSE              NOT NULL
);

ALTER TABLE licensing_pricing_plans
    ADD CONSTRAINT licensing_pricing_plans_pk
        PRIMARY KEY (id);

ALTER TABLE licensing_credit_subs
    ADD CONSTRAINT licensing_credit_subs_next_plan_id_fk
        FOREIGN KEY (next_plan_id) REFERENCES licensing_pricing_plans;

ALTER TABLE licensing_pricing_plans
    ADD UNIQUE (paddle_id);

ALTER TABLE licensing_payment_details
    ADD CONSTRAINT licensing_payment_details_licensing_pricing_plans_paddle_id_fk
        FOREIGN KEY (subscription_plan_id) REFERENCES licensing_pricing_plans (paddle_id);

ALTER TABLE licensing_pricing_plans
    ADD CONSTRAINT billing_type_allowed
        CHECK (billing_type = ANY (ARRAY ['month'::TEXT, 'year'::TEXT]));

CREATE TABLE IF NOT EXISTS licensing_settings (
    default_trial_storage NUMERIC DEFAULT 1  NOT NULL,
    default_storage       NUMERIC DEFAULT 25 NOT NULL,
    storage_addon_price   NUMERIC DEFAULT 0  NOT NULL,
    storage_addon_size    NUMERIC DEFAULT 0,
    default_monthly_plan  UUID,
    default_annual_plan   UUID,
    default_startup_plan  UUID,
    projects_limit        INTEGER DEFAULT 5  NOT NULL,
    team_member_limit     INTEGER DEFAULT 0  NOT NULL,
    free_tier_storage     INTEGER DEFAULT 5  NOT NULL,
    trial_duration        INTEGER DEFAULT 14 NOT NULL
);

COMMENT ON COLUMN licensing_settings.default_trial_storage IS 'default storage amount for a trial in Gigabytes(GB)';

COMMENT ON COLUMN licensing_settings.default_storage IS 'default storage amount for a paid account in Gigabytes(GB)';

ALTER TABLE licensing_settings
    ADD CONSTRAINT licensing_settings_licensing_pricing_plans_id_fk
        FOREIGN KEY (default_startup_plan) REFERENCES licensing_pricing_plans;

ALTER TABLE licensing_settings
    ADD CONSTRAINT licensing_settings_licensing_user_plans_id_fk
        FOREIGN KEY (default_monthly_plan) REFERENCES licensing_pricing_plans;

ALTER TABLE licensing_settings
    ADD CONSTRAINT licensing_settings_licensing_user_plans_id_fk_2
        FOREIGN KEY (default_annual_plan) REFERENCES licensing_pricing_plans;

CREATE TABLE IF NOT EXISTS licensing_user_subscription_modifiers (
    subscription_id INTEGER                                            NOT NULL,
    modifier_id     INTEGER                                            NOT NULL,
    created_at      TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP NOT NULL
);

CREATE TABLE IF NOT EXISTS licensing_user_subscriptions (
    id                          UUID    DEFAULT uuid_generate_v4() NOT NULL,
    user_id                     UUID                               NOT NULL,
    paddle_user_id              INTEGER,
    cancel_url                  TEXT,
    update_url                  TEXT,
    checkout_id                 TEXT,
    next_bill_date              TEXT,
    quantity                    INTEGER DEFAULT 1                  NOT NULL,
    subscription_id             INTEGER,
    subscription_plan_id        INTEGER,
    unit_price                  NUMERIC,
    plan_id                     UUID                               NOT NULL,
    status                      TEXT,
    custom_value_month          NUMERIC DEFAULT 0                  NOT NULL,
    custom_value_year           NUMERIC DEFAULT 0                  NOT NULL,
    custom_storage_amount       NUMERIC DEFAULT 0                  NOT NULL,
    custom_storage_unit         TEXT    DEFAULT 'MB'::TEXT         NOT NULL,
    cancellation_effective_date DATE,
    currency                    TEXT    DEFAULT 'USD'::TEXT        NOT NULL,
    event_time                  TEXT,
    paused_at                   TEXT,
    paused_from                 TEXT,
    paused_reason               TEXT,
    active                      BOOLEAN DEFAULT TRUE
);

ALTER TABLE licensing_user_subscriptions
    ADD CONSTRAINT licensing_user_plans_pk
        PRIMARY KEY (id);

ALTER TABLE licensing_user_subscriptions
    ADD UNIQUE (subscription_id);

ALTER TABLE licensing_user_subscriptions
    ADD CONSTRAINT licensing_user_subscriptions_licensing_pricing_plans_id_fk
        FOREIGN KEY (plan_id) REFERENCES licensing_pricing_plans;

ALTER TABLE licensing_user_subscriptions
    ADD CONSTRAINT licensing_user_subscriptions_statuses_allowed
        CHECK (status = ANY
               (ARRAY ['active'::TEXT, 'past_due'::TEXT, 'trialing'::TEXT, 'paused'::TEXT, 'deleted'::TEXT]));

CREATE TABLE IF NOT EXISTS notification_settings (
    email_notifications_enabled BOOLEAN DEFAULT TRUE  NOT NULL,
    popup_notifications_enabled BOOLEAN DEFAULT TRUE  NOT NULL,
    show_unread_items_count     BOOLEAN DEFAULT TRUE  NOT NULL,
    daily_digest_enabled        BOOLEAN DEFAULT FALSE NOT NULL,
    user_id                     UUID                  NOT NULL,
    team_id                     UUID                  NOT NULL
);

ALTER TABLE notification_settings
    ADD CONSTRAINT notification_settings_pk
        PRIMARY KEY (user_id, team_id);

CREATE TABLE IF NOT EXISTS organizations (
    id                       UUID                     DEFAULT uuid_generate_v4() NOT NULL,
    organization_name        TEXT                                                NOT NULL,
    contact_number           TEXT,
    contact_number_secondary TEXT,
    address_line_1           TEXT,
    address_line_2           TEXT,
    country                  UUID,
    city                     TEXT,
    state                    TEXT,
    postal_code              TEXT,
    trial_in_progress        BOOLEAN                  DEFAULT FALSE              NOT NULL,
    trial_expire_date        DATE,
    subscription_status      TEXT                     DEFAULT 'active'::TEXT     NOT NULL,
    storage                  INTEGER                  DEFAULT 1                  NOT NULL,
    updating_plan            BOOLEAN                  DEFAULT FALSE,
    user_id                  UUID                                                NOT NULL,
    created_at               TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at               TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    license_type_id          UUID,
    is_lkr_billing           BOOLEAN                  DEFAULT FALSE,
    working_hours            DOUBLE PRECISION         DEFAULT 8                  NOT NULL
);

ALTER TABLE organizations
    ADD CONSTRAINT organizations_pk
        PRIMARY KEY (id);

ALTER TABLE organizations
    ADD CONSTRAINT organizations_pk_2
        UNIQUE (user_id);

ALTER TABLE organizations
    ADD CONSTRAINT subscription_statuses_allowed
        CHECK (subscription_status = ANY
               (ARRAY ['active'::TEXT, 'past_due'::TEXT, 'trialing'::TEXT, 'paused'::TEXT, 'deleted'::TEXT, 'life_time_deal'::TEXT, 'free'::TEXT, 'custom'::TEXT, 'credit'::TEXT]));

CREATE TABLE IF NOT EXISTS personal_todo_list (
    id          UUID                     DEFAULT uuid_generate_v4() NOT NULL,
    name        TEXT                                                NOT NULL,
    description TEXT,
    color_code  WL_HEX_COLOR                                        NOT NULL,
    done        BOOLEAN                  DEFAULT FALSE              NOT NULL,
    index       INTEGER                  DEFAULT 0,
    user_id     UUID                                                NOT NULL,
    created_at  TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP  NOT NULL,
    updated_at  TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP  NOT NULL
);

ALTER TABLE personal_todo_list
    ADD CONSTRAINT personal_todo_list_pk
        PRIMARY KEY (id);

ALTER TABLE personal_todo_list
    ADD CONSTRAINT personal_todo_list_description_check
        CHECK (CHAR_LENGTH(description) <= 200);

ALTER TABLE personal_todo_list
    ADD CONSTRAINT personal_todo_list_name_check
        CHECK (CHAR_LENGTH(name) <= 100);

CREATE TABLE IF NOT EXISTS project_categories (
    id         UUID                     DEFAULT uuid_generate_v4() NOT NULL,
    name       TEXT                                                NOT NULL,
    color_code WL_HEX_COLOR             DEFAULT '#70a6f3'::TEXT    NOT NULL,
    team_id    UUID                                                NOT NULL,
    created_by UUID                                                NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP  NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP  NOT NULL
);

ALTER TABLE project_categories
    ADD CONSTRAINT project_categories_pk
        PRIMARY KEY (id);

CREATE TABLE IF NOT EXISTS project_comment_mentions (
    comment_id      UUID                                               NOT NULL,
    mentioned_index INTEGER                                            NOT NULL,
    mentioned_by    UUID                                               NOT NULL,
    informed_by     UUID                                               NOT NULL,
    created_at      TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP NOT NULL
);

CREATE TABLE IF NOT EXISTS project_comments (
    id         UUID                     DEFAULT uuid_generate_v4() NOT NULL,
    content    TEXT                                                NOT NULL,
    created_by UUID                                                NOT NULL,
    project_id UUID                                                NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP  NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP  NOT NULL
);

ALTER TABLE project_comments
    ADD CONSTRAINT project_comments_pk
        PRIMARY KEY (id);

ALTER TABLE project_comment_mentions
    ADD CONSTRAINT project_comment_mentions_comment_id_fk
        FOREIGN KEY (comment_id) REFERENCES project_comments
            ON DELETE CASCADE;

ALTER TABLE project_comments
    ADD CONSTRAINT project_comments_content_length_check
        CHECK (CHAR_LENGTH(content) <= 2000);

CREATE TABLE IF NOT EXISTS project_folders (
    id               UUID                     DEFAULT uuid_generate_v4() NOT NULL,
    name             TEXT                                                NOT NULL,
    key              TEXT                                                NOT NULL,
    color_code       WL_HEX_COLOR             DEFAULT '#70a6f3'::TEXT    NOT NULL,
    created_by       UUID                                                NOT NULL,
    parent_folder_id UUID,
    team_id          UUID                                                NOT NULL,
    created_at       TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP  NOT NULL,
    updated_at       TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP  NOT NULL
);

ALTER TABLE project_folders
    ADD CONSTRAINT project_folders_pk
        PRIMARY KEY (id);

ALTER TABLE project_folders
    ADD CONSTRAINT project_folders_parent_folder_fk
        FOREIGN KEY (parent_folder_id) REFERENCES project_folders;

CREATE TABLE IF NOT EXISTS project_logs (
    id          UUID                     DEFAULT uuid_generate_v4() NOT NULL,
    team_id     UUID                                                NOT NULL,
    project_id  UUID                                                NOT NULL,
    description TEXT                                                NOT NULL,
    created_at  TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP  NOT NULL
);

ALTER TABLE project_logs
    ADD CONSTRAINT project_logs_pk
        PRIMARY KEY (id);

CREATE TABLE IF NOT EXISTS project_member_allocations (
    id              UUID DEFAULT uuid_generate_v4() NOT NULL,
    project_id      UUID                            NOT NULL,
    team_member_id  UUID                            NOT NULL,
    allocated_from  TIMESTAMP WITH TIME ZONE        NOT NULL,
    allocated_to    TIMESTAMP WITH TIME ZONE        NOT NULL,
    seconds_per_day INTEGER
);

ALTER TABLE project_member_allocations
    ADD CONSTRAINT project_member_allocations_pk
        PRIMARY KEY (id);

CREATE TABLE IF NOT EXISTS project_members (
    id                      UUID                     DEFAULT uuid_generate_v4() NOT NULL,
    team_member_id          UUID                                                NOT NULL,
    project_access_level_id UUID                                                NOT NULL,
    project_id              UUID                                                NOT NULL,
    role_id                 UUID                                                NOT NULL,
    created_at              TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP  NOT NULL,
    default_view            TEXT                     DEFAULT 'TASK_LIST'::TEXT  NOT NULL
);

ALTER TABLE project_members
    ADD CONSTRAINT project_members_pk
        PRIMARY KEY (id);

ALTER TABLE project_members
    ADD CONSTRAINT project_members_access_level_fk
        FOREIGN KEY (project_access_level_id) REFERENCES project_access_levels;

CREATE TABLE IF NOT EXISTS project_phases (
    id         UUID                     DEFAULT uuid_generate_v4() NOT NULL,
    name       TEXT                                                NOT NULL,
    color_code WL_HEX_COLOR                                        NOT NULL,
    project_id UUID                                                NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP  NOT NULL,
    start_date TIMESTAMP WITH TIME ZONE,
    end_date   TIMESTAMP WITH TIME ZONE,
    sort_index INTEGER                  DEFAULT 0
);

ALTER TABLE project_phases
    ADD CONSTRAINT project_phases_pk
        PRIMARY KEY (id);

CREATE TABLE IF NOT EXISTS project_subscribers (
    id             UUID                     DEFAULT uuid_generate_v4() NOT NULL,
    user_id        UUID                                                NOT NULL,
    project_id     UUID                                                NOT NULL,
    team_member_id UUID                                                NOT NULL,
    created_at     TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP  NOT NULL
);

ALTER TABLE project_subscribers
    ADD CONSTRAINT project_subscribers_pk
        PRIMARY KEY (id);

CREATE TABLE IF NOT EXISTS project_task_list_cols (
    id                UUID    DEFAULT uuid_generate_v4() NOT NULL,
    name              TEXT                               NOT NULL,
    key               WL_TASK_LIST_COL_KEY               NOT NULL,
    index             INTEGER DEFAULT 0                  NOT NULL,
    pinned            BOOLEAN DEFAULT TRUE               NOT NULL,
    project_id        UUID                               NOT NULL,
    custom_column     BOOLEAN DEFAULT FALSE,
    custom_column_obj JSONB
);

ALTER TABLE project_task_list_cols
    ADD CONSTRAINT project_task_list_cols_pk
        PRIMARY KEY (id);

CREATE TABLE IF NOT EXISTS projects (
    id                     UUID                     DEFAULT uuid_generate_v4() NOT NULL,
    name                   TEXT                                                NOT NULL,
    key                    TEXT                                                NOT NULL,
    color_code             WL_HEX_COLOR             DEFAULT '#70a6f3'::TEXT    NOT NULL,
    notes                  TEXT,
    tasks_counter          BIGINT                   DEFAULT 0                  NOT NULL,
    start_date             TIMESTAMP WITH TIME ZONE,
    end_date               TIMESTAMP WITH TIME ZONE,
    team_id                UUID                                                NOT NULL,
    client_id              UUID,
    owner_id               UUID                                                NOT NULL,
    status_id              UUID                                                NOT NULL,
    created_at             TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP  NOT NULL,
    updated_at             TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP  NOT NULL,
    category_id            UUID,
    folder_id              UUID,
    phase_label            TEXT                     DEFAULT 'Phase'::TEXT      NOT NULL,
    estimated_man_days     INTEGER                  DEFAULT 0,
    hours_per_day          INTEGER                  DEFAULT 8,
    health_id              UUID,
    estimated_working_days INTEGER                  DEFAULT 0
);

ALTER TABLE projects
    ADD CONSTRAINT projects_pk
        PRIMARY KEY (id);

ALTER TABLE archived_projects
    ADD CONSTRAINT archived_projects_project_id_fk
        FOREIGN KEY (project_id) REFERENCES projects
            ON DELETE CASCADE;

ALTER TABLE favorite_projects
    ADD CONSTRAINT favorite_projects_project_id_fk
        FOREIGN KEY (project_id) REFERENCES projects
            ON DELETE CASCADE;

ALTER TABLE project_comments
    ADD CONSTRAINT project_comments_project_id_fk
        FOREIGN KEY (project_id) REFERENCES projects
            ON DELETE CASCADE;

ALTER TABLE project_logs
    ADD CONSTRAINT project_logs_projects_id_fk
        FOREIGN KEY (project_id) REFERENCES projects
            ON DELETE CASCADE;

ALTER TABLE project_member_allocations
    ADD CONSTRAINT project_members_allocations_project_id_fk
        FOREIGN KEY (project_id) REFERENCES projects
            ON DELETE CASCADE;

ALTER TABLE project_members
    ADD CONSTRAINT project_members_project_id_fk
        FOREIGN KEY (project_id) REFERENCES projects
            ON DELETE CASCADE;

ALTER TABLE project_phases
    ADD CONSTRAINT project_phases_project_id_fk
        FOREIGN KEY (project_id) REFERENCES projects
            ON DELETE CASCADE;

ALTER TABLE project_subscribers
    ADD CONSTRAINT project_subscribers_project_id_fk
        FOREIGN KEY (project_id) REFERENCES projects
            ON DELETE CASCADE;

ALTER TABLE project_task_list_cols
    ADD CONSTRAINT project_task_list_cols_project_fk
        FOREIGN KEY (project_id) REFERENCES projects
            ON DELETE CASCADE;

ALTER TABLE projects
    ADD CONSTRAINT projects_category_id_fk
        FOREIGN KEY (category_id) REFERENCES project_categories
            ON DELETE CASCADE;

ALTER TABLE projects
    ADD CONSTRAINT projects_client_id_fk
        FOREIGN KEY (client_id) REFERENCES clients
            ON DELETE SET NULL;

ALTER TABLE projects
    ADD CONSTRAINT projects_folder_id_fk
        FOREIGN KEY (folder_id) REFERENCES project_folders
            ON DELETE SET DEFAULT;

ALTER TABLE projects
    ADD CONSTRAINT projects_name_check
        CHECK (CHAR_LENGTH(name) <= 100);

ALTER TABLE projects
    ADD CONSTRAINT projects_notes_check
        CHECK (CHAR_LENGTH(notes) <= 500);

CREATE TABLE IF NOT EXISTS pt_labels (
    id          UUID DEFAULT uuid_generate_v4() NOT NULL,
    name        TEXT                            NOT NULL,
    color_code  TEXT                            NOT NULL,
    template_id UUID
);

ALTER TABLE pt_labels
    ADD CONSTRAINT pt_project_templates_labels_pk
        PRIMARY KEY (id);

CREATE TABLE IF NOT EXISTS pt_phases (
    id          UUID DEFAULT uuid_generate_v4() NOT NULL,
    name        TEXT                            NOT NULL,
    color_code  TEXT,
    template_id UUID                            NOT NULL
);

ALTER TABLE pt_phases
    ADD CONSTRAINT pt_project_template_phases_pk
        PRIMARY KEY (id);

CREATE TABLE IF NOT EXISTS pt_project_templates (
    id          UUID DEFAULT uuid_generate_v4() NOT NULL,
    name        TEXT                            NOT NULL,
    key         TEXT                            NOT NULL,
    description TEXT,
    phase_label TEXT,
    image_url   TEXT,
    color_code  TEXT DEFAULT '#3b7ad4'::TEXT    NOT NULL
);

ALTER TABLE pt_project_templates
    ADD CONSTRAINT pt_project_templates_pk
        PRIMARY KEY (id);

ALTER TABLE pt_labels
    ADD CONSTRAINT pt_labels_pt_project_templates_id_fk
        FOREIGN KEY (template_id) REFERENCES pt_project_templates;

ALTER TABLE pt_phases
    ADD CONSTRAINT pt_project_template_phases_template_id_fk
        FOREIGN KEY (template_id) REFERENCES pt_project_templates
            ON DELETE CASCADE;

ALTER TABLE pt_project_templates
    ADD CONSTRAINT pt_project_templates_key_unique
        UNIQUE (key);

CREATE TABLE IF NOT EXISTS pt_statuses (
    id          UUID DEFAULT uuid_generate_v4() NOT NULL,
    name        TEXT                            NOT NULL,
    template_id UUID                            NOT NULL,
    category_id UUID                            NOT NULL
);

ALTER TABLE pt_statuses
    ADD CONSTRAINT pt_project_template_statuses_pk
        PRIMARY KEY (id);

ALTER TABLE pt_statuses
    ADD CONSTRAINT pt_project_template_statuses_template_id_fk
        FOREIGN KEY (template_id) REFERENCES pt_project_templates
            ON DELETE CASCADE;

CREATE TABLE IF NOT EXISTS pt_task_labels (
    task_id  UUID NOT NULL,
    label_id UUID NOT NULL
);

ALTER TABLE pt_task_labels
    ADD CONSTRAINT pt_task_labels_pk
        PRIMARY KEY (task_id, label_id);

ALTER TABLE pt_task_labels
    ADD CONSTRAINT pt_task_labels_label_id_fk
        FOREIGN KEY (label_id) REFERENCES pt_labels;

CREATE TABLE IF NOT EXISTS pt_task_phases (
    task_id  UUID NOT NULL,
    phase_id UUID NOT NULL
);

ALTER TABLE pt_task_phases
    ADD CONSTRAINT pt_task_phase_phase_id_fk
        FOREIGN KEY (phase_id) REFERENCES pt_phases
            ON DELETE CASCADE;

CREATE TABLE IF NOT EXISTS pt_task_statuses (
    id          UUID    DEFAULT uuid_generate_v4() NOT NULL,
    name        TEXT                               NOT NULL,
    template_id UUID                               NOT NULL,
    team_id     UUID                               NOT NULL,
    category_id UUID                               NOT NULL,
    sort_order  INTEGER DEFAULT 0                  NOT NULL
);

ALTER TABLE pt_task_statuses
    ADD CONSTRAINT pt_task_statuses_pk
        PRIMARY KEY (id);

ALTER TABLE pt_task_statuses
    ADD CONSTRAINT pt_task_statuses_template_id_fk
        FOREIGN KEY (template_id) REFERENCES pt_project_templates
            ON DELETE CASCADE;

CREATE TABLE IF NOT EXISTS pt_tasks (
    id             UUID    DEFAULT uuid_generate_v4() NOT NULL,
    name           TEXT                               NOT NULL,
    description    TEXT,
    total_minutes  NUMERIC DEFAULT 0                  NOT NULL,
    sort_order     INTEGER DEFAULT 0                  NOT NULL,
    priority_id    UUID                               NOT NULL,
    template_id    UUID                               NOT NULL,
    parent_task_id UUID,
    status_id      UUID                               NOT NULL
);

ALTER TABLE pt_tasks
    ADD CONSTRAINT pt_tasks_pk
        PRIMARY KEY (id);

ALTER TABLE pt_task_labels
    ADD CONSTRAINT pt_task_labels_task_id_fk
        FOREIGN KEY (task_id) REFERENCES pt_tasks
            ON DELETE CASCADE;

ALTER TABLE pt_task_phases
    ADD CONSTRAINT pt_task_phase_task_id_fk
        FOREIGN KEY (task_id) REFERENCES pt_tasks
            ON DELETE CASCADE;

ALTER TABLE pt_tasks
    ADD CONSTRAINT pt_tasks_sort_order_unique
        UNIQUE (template_id, sort_order)
            DEFERRABLE INITIALLY DEFERRED;

ALTER TABLE pt_tasks
    ADD CONSTRAINT pt_tasks_parent_task_id_fk
        FOREIGN KEY (parent_task_id) REFERENCES pt_tasks
            ON DELETE CASCADE;

ALTER TABLE pt_tasks
    ADD CONSTRAINT pt_tasks_status_id_fk
        FOREIGN KEY (status_id) REFERENCES pt_statuses
            ON DELETE RESTRICT;

ALTER TABLE pt_tasks
    ADD CONSTRAINT pt_tasks_template_fk
        FOREIGN KEY (template_id) REFERENCES pt_project_templates
            ON DELETE CASCADE;

ALTER TABLE pt_tasks
    ADD CONSTRAINT pt_tasks_task_order_check
        CHECK (sort_order >= 0);

ALTER TABLE pt_tasks
    ADD CONSTRAINT pt_tasks_total_minutes_check
        CHECK ((total_minutes >= (0)::NUMERIC) AND (total_minutes <= (999999)::NUMERIC));

CREATE TABLE IF NOT EXISTS role_permissions (
    role_id       UUID NOT NULL,
    permission_id TEXT NOT NULL
);

ALTER TABLE role_permissions
    ADD CONSTRAINT role_permissions_pk
        PRIMARY KEY (role_id, permission_id);

ALTER TABLE role_permissions
    ADD CONSTRAINT role_permissions_permission_id_fk
        FOREIGN KEY (permission_id) REFERENCES permissions;

CREATE TABLE IF NOT EXISTS roles (
    id           UUID    DEFAULT uuid_generate_v4() NOT NULL,
    name         TEXT                               NOT NULL,
    team_id      UUID                               NOT NULL,
    default_role BOOLEAN DEFAULT FALSE              NOT NULL,
    admin_role   BOOLEAN DEFAULT FALSE              NOT NULL,
    owner        BOOLEAN DEFAULT FALSE              NOT NULL
);

ALTER TABLE roles
    ADD CONSTRAINT roles_pk
        PRIMARY KEY (id);

ALTER TABLE project_members
    ADD CONSTRAINT project_members_role_id_fk
        FOREIGN KEY (role_id) REFERENCES roles;

ALTER TABLE role_permissions
    ADD CONSTRAINT role_permissions_role_id_fk
        FOREIGN KEY (role_id) REFERENCES roles;

CREATE TABLE IF NOT EXISTS spam_emails (
    id         UUID                     DEFAULT uuid_generate_v4() NOT NULL,
    email      TEXT                                                NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP  NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP  NOT NULL
);

ALTER TABLE spam_emails
    ADD CONSTRAINT spam_emails_pk
        PRIMARY KEY (id);

CREATE TABLE IF NOT EXISTS sys_project_healths (
    id         UUID    DEFAULT uuid_generate_v4() NOT NULL,
    name       TEXT                               NOT NULL,
    color_code WL_HEX_COLOR                       NOT NULL,
    sort_order INTEGER DEFAULT 0                  NOT NULL,
    is_default BOOLEAN DEFAULT FALSE              NOT NULL
);

ALTER TABLE sys_project_healths
    ADD CONSTRAINT sys_project_healths_pk
        PRIMARY KEY (id);

CREATE TABLE IF NOT EXISTS sys_project_statuses (
    id         UUID    DEFAULT uuid_generate_v4() NOT NULL,
    name       TEXT                               NOT NULL,
    color_code WL_HEX_COLOR                       NOT NULL,
    icon       TEXT                               NOT NULL,
    sort_order INTEGER DEFAULT 0                  NOT NULL,
    is_default BOOLEAN DEFAULT FALSE              NOT NULL
);

ALTER TABLE sys_project_statuses
    ADD CONSTRAINT sys_project_statuses_pk
        PRIMARY KEY (id);

CREATE TABLE IF NOT EXISTS sys_task_status_categories (
    id              UUID    DEFAULT uuid_generate_v4() NOT NULL,
    name            TEXT                               NOT NULL,
    color_code      WL_HEX_COLOR                       NOT NULL,
    index           INTEGER DEFAULT 0                  NOT NULL,
    is_todo         BOOLEAN DEFAULT FALSE              NOT NULL,
    is_doing        BOOLEAN DEFAULT FALSE              NOT NULL,
    is_done         BOOLEAN DEFAULT FALSE              NOT NULL,
    description     TEXT,
    color_code_dark WL_HEX_COLOR
);

ALTER TABLE sys_task_status_categories
    ADD CONSTRAINT sys_task_status_categories_pk
        PRIMARY KEY (id);

ALTER TABLE cpt_task_statuses
    ADD CONSTRAINT cpt_task_statuses_category_id_fk
        FOREIGN KEY (category_id) REFERENCES sys_task_status_categories;

ALTER TABLE pt_statuses
    ADD CONSTRAINT pt_project_template_statuses_category_id_fk
        FOREIGN KEY (category_id) REFERENCES sys_task_status_categories;

ALTER TABLE pt_task_statuses
    ADD CONSTRAINT pt_task_statuses_category_id_fk
        FOREIGN KEY (category_id) REFERENCES sys_task_status_categories;

CREATE TABLE IF NOT EXISTS task_activity_logs (
    id             UUID                     DEFAULT uuid_generate_v4() NOT NULL,
    task_id        UUID                                                NOT NULL,
    team_id        UUID                                                NOT NULL,
    attribute_type TEXT                                                NOT NULL,
    user_id        UUID                                                NOT NULL,
    log_type       TEXT,
    old_value      TEXT,
    new_value      TEXT,
    prev_string    TEXT,
    next_string    TEXT,
    created_at     TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP  NOT NULL,
    project_id     UUID                                                NOT NULL
);

COMMENT ON COLUMN task_activity_logs.user_id IS 'id of the user who initiated the activity';

COMMENT ON COLUMN task_activity_logs.log_type IS 'whether the log belongs to create, update, delete, assign or unassign category';

ALTER TABLE task_activity_logs
    ADD CONSTRAINT task_activity_logs_pk
        PRIMARY KEY (id);

ALTER TABLE task_activity_logs
    ADD CONSTRAINT task_activity_logs_projects_id_fk
        FOREIGN KEY (project_id) REFERENCES projects
            ON DELETE CASCADE;

ALTER TABLE task_activity_logs
    ADD CONSTRAINT task_activity_logs_log_type_check
        CHECK (log_type = ANY (ARRAY ['create'::TEXT, 'update'::TEXT, 'delete'::TEXT, 'assign'::TEXT, 'unassign'::TEXT]));

CREATE TABLE IF NOT EXISTS task_attachments (
    id          UUID                     DEFAULT uuid_generate_v4() NOT NULL,
    name        TEXT                                                NOT NULL,
    size        BIGINT                   DEFAULT 0                  NOT NULL,
    type        TEXT                                                NOT NULL,
    task_id     UUID,
    team_id     UUID                                                NOT NULL,
    project_id  UUID                                                NOT NULL,
    uploaded_by UUID                                                NOT NULL,
    created_at  TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP  NOT NULL
);

ALTER TABLE task_attachments
    ADD CONSTRAINT task_attachments_pk
        PRIMARY KEY (id);

ALTER TABLE task_attachments
    ADD CONSTRAINT task_attachments_project_id_fk
        FOREIGN KEY (project_id) REFERENCES projects
            ON DELETE CASCADE;

ALTER TABLE task_attachments
    ADD CONSTRAINT task_attachments_name_check
        CHECK (CHAR_LENGTH(name) <= 110);

CREATE TABLE IF NOT EXISTS task_comment_contents (
    index          INTEGER NOT NULL,
    comment_id     UUID    NOT NULL,
    team_member_id UUID,
    text_content   TEXT
);

ALTER TABLE task_comment_contents
    ADD CONSTRAINT task_comment_contents_content_check
        CHECK (((team_member_id IS NULL) AND (text_content IS NULL)) IS FALSE);

ALTER TABLE task_comment_contents
    ADD CONSTRAINT task_comment_contents_name_check
        CHECK (CHAR_LENGTH(text_content) <= 5000);

CREATE TABLE IF NOT EXISTS task_comments (
    id             UUID                     DEFAULT uuid_generate_v4() NOT NULL,
    user_id        UUID                                                NOT NULL,
    team_member_id UUID                                                NOT NULL,
    task_id        UUID                                                NOT NULL,
    created_at     TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP  NOT NULL,
    updated_at     TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP  NOT NULL,
    ses_message_id TEXT
);

ALTER TABLE task_comments
    ADD CONSTRAINT task_comments_pk
        PRIMARY KEY (id);

ALTER TABLE task_comment_contents
    ADD CONSTRAINT task_comment_contents_comment_id_fk
        FOREIGN KEY (comment_id) REFERENCES task_comments
            ON DELETE CASCADE;

CREATE TABLE IF NOT EXISTS task_labels (
    task_id  UUID NOT NULL,
    label_id UUID NOT NULL
);

ALTER TABLE task_labels
    ADD CONSTRAINT task_labels_pk
        PRIMARY KEY (task_id, label_id);

CREATE TABLE IF NOT EXISTS team_labels (
    id         UUID DEFAULT uuid_generate_v4() NOT NULL,
    name       TEXT                            NOT NULL,
    color_code WL_HEX_COLOR                    NOT NULL,
    team_id    UUID                            NOT NULL
);

ALTER TABLE team_labels
    ADD CONSTRAINT team_labels_pk
        PRIMARY KEY (id);

ALTER TABLE cpt_task_labels
    ADD CONSTRAINT cpt_task_labels_label_id_fk
        FOREIGN KEY (label_id) REFERENCES team_labels
            ON DELETE CASCADE;

ALTER TABLE task_labels
    ADD CONSTRAINT task_labels_label_id_fk
        FOREIGN KEY (label_id) REFERENCES team_labels
            ON DELETE CASCADE;

ALTER TABLE team_labels
    ADD CONSTRAINT team_labels_name_check
        CHECK (CHAR_LENGTH(name) <= 40);

CREATE TABLE IF NOT EXISTS task_phase (
    task_id  UUID NOT NULL,
    phase_id UUID NOT NULL
);

ALTER TABLE task_phase
    ADD CONSTRAINT task_phase_phase_id_fk
        FOREIGN KEY (phase_id) REFERENCES project_phases
            ON DELETE CASCADE;

CREATE TABLE IF NOT EXISTS task_priorities (
    id              UUID    DEFAULT uuid_generate_v4() NOT NULL,
    name            TEXT                               NOT NULL,
    value           INTEGER DEFAULT 0                  NOT NULL,
    color_code      WL_HEX_COLOR                       NOT NULL,
    color_code_dark WL_HEX_COLOR
);

ALTER TABLE task_priorities
    ADD CONSTRAINT task_priorities_pk
        PRIMARY KEY (id);

ALTER TABLE cpt_tasks
    ADD CONSTRAINT cpt_tasks_priority_fk
        FOREIGN KEY (priority_id) REFERENCES task_priorities;

ALTER TABLE pt_tasks
    ADD CONSTRAINT pt_tasks_priority_fk
        FOREIGN KEY (priority_id) REFERENCES task_priorities;

CREATE TABLE IF NOT EXISTS task_statuses (
    id          UUID    DEFAULT uuid_generate_v4() NOT NULL,
    name        TEXT                               NOT NULL,
    project_id  UUID                               NOT NULL,
    team_id     UUID                               NOT NULL,
    category_id UUID                               NOT NULL,
    sort_order  INTEGER DEFAULT 0                  NOT NULL
);

ALTER TABLE task_statuses
    ADD CONSTRAINT task_statuses_pk
        PRIMARY KEY (id);

ALTER TABLE task_statuses
    ADD CONSTRAINT task_statuses_category_id_fk
        FOREIGN KEY (category_id) REFERENCES sys_task_status_categories;

ALTER TABLE task_statuses
    ADD CONSTRAINT task_statuses_project_id_fk
        FOREIGN KEY (project_id) REFERENCES projects
            ON DELETE CASCADE;

ALTER TABLE task_statuses
    ADD CONSTRAINT task_statuses_name_check
        CHECK (CHAR_LENGTH(name) <= 50);

CREATE TABLE IF NOT EXISTS task_subscribers (
    id             UUID                     DEFAULT uuid_generate_v4() NOT NULL,
    user_id        UUID                                                NOT NULL,
    task_id        UUID                                                NOT NULL,
    team_member_id UUID                                                NOT NULL,
    action         TEXT                                                NOT NULL,
    created_at     TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP  NOT NULL
);

ALTER TABLE task_subscribers
    ADD CONSTRAINT task_subscribers_pk
        PRIMARY KEY (id);

ALTER TABLE task_subscribers
    ADD CONSTRAINT task_subscribers_action_check
        CHECK (action = 'WHEN_DONE'::TEXT);

CREATE TABLE IF NOT EXISTS task_templates (
    id         UUID                     DEFAULT uuid_generate_v4() NOT NULL,
    name       TEXT                                                NOT NULL,
    team_id    UUID                                                NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP  NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP  NOT NULL
);

ALTER TABLE task_templates
    ADD CONSTRAINT task_templates_pk
        PRIMARY KEY (id);

CREATE TABLE IF NOT EXISTS task_templates_tasks (
    name          TEXT              NOT NULL,
    template_id   UUID              NOT NULL,
    total_minutes NUMERIC DEFAULT 0 NOT NULL
);

ALTER TABLE task_templates_tasks
    ADD CONSTRAINT task_templates_tasks_template_id_fk
        FOREIGN KEY (template_id) REFERENCES task_templates
            ON DELETE CASCADE;

CREATE TABLE IF NOT EXISTS task_timers (
    task_id    UUID NOT NULL,
    user_id    UUID NOT NULL,
    start_time TIMESTAMP WITH TIME ZONE
);

ALTER TABLE task_timers
    ADD CONSTRAINT task_timers_pk
        PRIMARY KEY (task_id, user_id);

CREATE TABLE IF NOT EXISTS task_updates (
    id          UUID                     DEFAULT uuid_generate_v4() NOT NULL,
    type        TEXT                                                NOT NULL,
    reporter_id UUID                                                NOT NULL,
    task_id     UUID                                                NOT NULL,
    user_id     UUID                                                NOT NULL,
    team_id     UUID                                                NOT NULL,
    project_id  UUID                                                NOT NULL,
    is_sent     BOOLEAN                  DEFAULT FALSE              NOT NULL,
    created_at  TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP  NOT NULL,
    retry_count INTEGER                  DEFAULT 0
);

ALTER TABLE task_updates
    ADD CONSTRAINT task_updates_pk
        PRIMARY KEY (id);

ALTER TABLE task_updates
    ADD CONSTRAINT task_updates_project_id_fk
        FOREIGN KEY (project_id) REFERENCES projects
            ON DELETE CASCADE;

ALTER TABLE task_updates
    ADD CONSTRAINT task_updates_type_check
        CHECK (type = ANY (ARRAY ['ASSIGN'::TEXT, 'UNASSIGN'::TEXT]));

CREATE TABLE IF NOT EXISTS task_work_log (
    id              UUID                     DEFAULT uuid_generate_v4() NOT NULL,
    time_spent      NUMERIC                  DEFAULT 0                  NOT NULL,
    description     TEXT,
    logged_by_timer BOOLEAN                  DEFAULT FALSE              NOT NULL,
    task_id         UUID                                                NOT NULL,
    user_id         UUID                                                NOT NULL,
    created_at      TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP  NOT NULL,
    updated_at      TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP  NOT NULL
);

ALTER TABLE task_work_log
    ADD CONSTRAINT task_work_log_pk
        PRIMARY KEY (id);

ALTER TABLE task_work_log
    ADD CONSTRAINT task_work_log_description_check
        CHECK (CHAR_LENGTH(description) <= 500);

ALTER TABLE task_work_log
    ADD CONSTRAINT task_work_log_time_spent_check
        CHECK (time_spent >= (0)::NUMERIC);

CREATE TABLE IF NOT EXISTS tasks (
    id                  UUID                     DEFAULT uuid_generate_v4() NOT NULL,
    name                TEXT                                                NOT NULL,
    description         TEXT,
    done                BOOLEAN                  DEFAULT FALSE              NOT NULL,
    total_minutes       NUMERIC                  DEFAULT 0                  NOT NULL,
    archived            BOOLEAN                  DEFAULT FALSE              NOT NULL,
    task_no             BIGINT                                              NOT NULL,
    start_date          TIMESTAMP WITH TIME ZONE,
    end_date            TIMESTAMP WITH TIME ZONE,
    priority_id         UUID                                                NOT NULL,
    project_id          UUID                                                NOT NULL,
    reporter_id         UUID                                                NOT NULL,
    parent_task_id      UUID,
    status_id           UUID                                                NOT NULL,
    completed_at        TIMESTAMP WITH TIME ZONE,
    created_at          TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP  NOT NULL,
    updated_at          TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP  NOT NULL,
    sort_order          INTEGER                  DEFAULT 0                  NOT NULL,
    roadmap_sort_order  INTEGER                  DEFAULT 0                  NOT NULL,
    status_sort_order   INTEGER                  DEFAULT 0                  NOT NULL,
    priority_sort_order INTEGER                  DEFAULT 0                  NOT NULL,
    phase_sort_order    INTEGER                  DEFAULT 0                  NOT NULL,
    billable            BOOLEAN                  DEFAULT TRUE,
    schedule_id         UUID
);

ALTER TABLE tasks
    ADD CONSTRAINT tasks_pk
        PRIMARY KEY (id);

ALTER TABLE task_activity_logs
    ADD CONSTRAINT task_activity_logs_tasks_id_fk
        FOREIGN KEY (task_id) REFERENCES tasks
            ON DELETE CASCADE;

ALTER TABLE task_attachments
    ADD CONSTRAINT task_attachments_task_id_fk
        FOREIGN KEY (task_id) REFERENCES tasks
            ON DELETE SET NULL;

ALTER TABLE task_comments
    ADD CONSTRAINT task_comments_task_id_fk
        FOREIGN KEY (task_id) REFERENCES tasks
            ON DELETE CASCADE;

ALTER TABLE task_labels
    ADD CONSTRAINT task_labels_task_id_fk
        FOREIGN KEY (task_id) REFERENCES tasks
            ON DELETE CASCADE;

ALTER TABLE task_phase
    ADD CONSTRAINT task_phase_task_id_fk
        FOREIGN KEY (task_id) REFERENCES tasks
            ON DELETE CASCADE;

ALTER TABLE task_subscribers
    ADD CONSTRAINT task_subscribers_task_id_fk
        FOREIGN KEY (task_id) REFERENCES tasks
            ON DELETE CASCADE;

ALTER TABLE task_timers
    ADD CONSTRAINT task_timers_task_id_fk
        FOREIGN KEY (task_id) REFERENCES tasks
            ON DELETE CASCADE;

ALTER TABLE task_updates
    ADD CONSTRAINT task_updates_task_id_fk
        FOREIGN KEY (task_id) REFERENCES tasks
            ON DELETE CASCADE;

ALTER TABLE task_work_log
    ADD CONSTRAINT task_work_log_task_id_fk
        FOREIGN KEY (task_id) REFERENCES tasks
            ON DELETE CASCADE;

ALTER TABLE tasks
    ADD CONSTRAINT tasks_sort_order_unique
        UNIQUE (project_id, sort_order)
            DEFERRABLE INITIALLY DEFERRED;

ALTER TABLE tasks
    ADD CONSTRAINT tasks_parent_task_id_fk
        FOREIGN KEY (parent_task_id) REFERENCES tasks
            ON DELETE CASCADE;

ALTER TABLE tasks
    ADD CONSTRAINT tasks_priority_fk
        FOREIGN KEY (priority_id) REFERENCES task_priorities;

ALTER TABLE tasks
    ADD CONSTRAINT tasks_status_id_fk
        FOREIGN KEY (status_id) REFERENCES task_statuses
            ON DELETE RESTRICT;

ALTER TABLE tasks
    ADD CONSTRAINT tasks_project_fk
        FOREIGN KEY (project_id) REFERENCES projects
            ON DELETE CASCADE;

ALTER TABLE tasks
    ADD CONSTRAINT tasks_description_check
        CHECK (CHAR_LENGTH(description) <= 500000);

ALTER TABLE tasks
    ADD CONSTRAINT tasks_name_check
        CHECK (CHAR_LENGTH(name) <= 500);

ALTER TABLE tasks
    ADD CONSTRAINT tasks_total_minutes_check
        CHECK ((total_minutes >= (0)::NUMERIC) AND (total_minutes <= (999999)::NUMERIC));

-- Add constraints for new sort order columns
ALTER TABLE tasks ADD CONSTRAINT tasks_status_sort_order_check CHECK (status_sort_order >= 0);
ALTER TABLE tasks ADD CONSTRAINT tasks_priority_sort_order_check CHECK (priority_sort_order >= 0);
ALTER TABLE tasks ADD CONSTRAINT tasks_phase_sort_order_check CHECK (phase_sort_order >= 0);

-- Add indexes for performance on new sort order columns
CREATE INDEX IF NOT EXISTS idx_tasks_status_sort_order ON tasks(project_id, status_sort_order);
CREATE INDEX IF NOT EXISTS idx_tasks_priority_sort_order ON tasks(project_id, priority_sort_order);
CREATE INDEX IF NOT EXISTS idx_tasks_phase_sort_order ON tasks(project_id, phase_sort_order);

-- Add comments for documentation
COMMENT ON COLUMN tasks.status_sort_order IS 'Sort order when grouped by status';
COMMENT ON COLUMN tasks.priority_sort_order IS 'Sort order when grouped by priority';
COMMENT ON COLUMN tasks.phase_sort_order IS 'Sort order when grouped by phase';

CREATE TABLE IF NOT EXISTS tasks_assignees (
    task_id           UUID                                               NOT NULL,
    project_member_id UUID                                               NOT NULL,
    team_member_id    UUID                                               NOT NULL,
    created_at        TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_at        TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP NOT NULL,
    assigned_by       UUID                                               NOT NULL
);

ALTER TABLE tasks_assignees
    ADD CONSTRAINT tasks_assignees_pk
        PRIMARY KEY (task_id, project_member_id);

ALTER TABLE tasks_assignees
    ADD CONSTRAINT tasks_assignees_project_member_id_fk
        FOREIGN KEY (project_member_id) REFERENCES project_members
            ON UPDATE CASCADE ON DELETE CASCADE;

ALTER TABLE tasks_assignees
    ADD CONSTRAINT tasks_assignees_task_id_fk
        FOREIGN KEY (task_id) REFERENCES tasks
            ON DELETE CASCADE;

CREATE TABLE IF NOT EXISTS team_members (
    id           UUID                     DEFAULT uuid_generate_v4() NOT NULL,
    user_id      UUID,
    team_id      UUID                                                NOT NULL,
    role_id      UUID                                                NOT NULL,
    job_title_id UUID,
    created_at   TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP  NOT NULL,
    updated_at   TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP  NOT NULL,
    active       BOOLEAN                  DEFAULT TRUE
);

ALTER TABLE team_members
    ADD CONSTRAINT team_members_pk
        PRIMARY KEY (id);

ALTER TABLE email_invitations
    ADD CONSTRAINT email_invitations_team_member_id_fk
        FOREIGN KEY (team_member_id) REFERENCES team_members
            ON DELETE CASCADE;

ALTER TABLE project_member_allocations
    ADD CONSTRAINT project_members_allocations_team_member_id_fk
        FOREIGN KEY (team_member_id) REFERENCES team_members
            ON DELETE CASCADE;

ALTER TABLE project_members
    ADD CONSTRAINT project_members_team_member_id_fk
        FOREIGN KEY (team_member_id) REFERENCES team_members
            ON DELETE CASCADE;

ALTER TABLE project_subscribers
    ADD CONSTRAINT project_subscribers_team_member_id_fk
        FOREIGN KEY (team_member_id) REFERENCES team_members
            ON DELETE CASCADE;

ALTER TABLE task_comment_contents
    ADD CONSTRAINT task_comment_contents_team_member_fk
        FOREIGN KEY (team_member_id) REFERENCES team_members;

ALTER TABLE task_comments
    ADD CONSTRAINT task_comments_team_member_id_fk
        FOREIGN KEY (team_member_id) REFERENCES team_members
            ON DELETE CASCADE;

ALTER TABLE task_subscribers
    ADD CONSTRAINT task_subscribers_team_member_id_fk
        FOREIGN KEY (team_member_id) REFERENCES team_members
            ON DELETE CASCADE;

ALTER TABLE tasks_assignees
    ADD CONSTRAINT tasks_assignees_team_member_fk
        FOREIGN KEY (team_member_id) REFERENCES team_members
            ON DELETE CASCADE;

ALTER TABLE team_members
    ADD CONSTRAINT team_members_job_title_id_fk
        FOREIGN KEY (job_title_id) REFERENCES job_titles
            ON DELETE SET NULL;

ALTER TABLE team_members
    ADD CONSTRAINT team_members_role_id_fk
        FOREIGN KEY (role_id) REFERENCES roles;

CREATE TABLE IF NOT EXISTS users (
    id              UUID                     DEFAULT uuid_generate_v4()                     NOT NULL,
    name            TEXT                                                                    NOT NULL,
    email           WL_EMAIL                                                                NOT NULL,
    password        TEXT,
    active_team     UUID,
    avatar_url      TEXT,
    setup_completed BOOLEAN                  DEFAULT FALSE                                  NOT NULL,
    user_no         BIGINT                   DEFAULT NEXTVAL('users_user_no_seq'::REGCLASS) NOT NULL,
    timezone_id     UUID                                                                    NOT NULL,
    google_id       TEXT,
    socket_id       TEXT,
    created_at      TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP                      NOT NULL,
    updated_at      TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP                      NOT NULL,
    last_active     TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP                      NOT NULL,
    temp_email      BOOLEAN                  DEFAULT FALSE,
    is_deleted      BOOLEAN                  DEFAULT FALSE,
    deleted_at      TIMESTAMP WITH TIME ZONE,
    language        LANGUAGE_TYPE            DEFAULT 'en'::LANGUAGE_TYPE
);

ALTER TABLE users
    ADD CONSTRAINT users_pk
        PRIMARY KEY (id);

ALTER TABLE archived_projects
    ADD CONSTRAINT archived_projects_user_id_fk
        FOREIGN KEY (user_id) REFERENCES users;

ALTER TABLE favorite_projects
    ADD CONSTRAINT favorite_projects_user_id_fk
        FOREIGN KEY (user_id) REFERENCES users;

ALTER TABLE licensing_coupon_codes
    ADD CONSTRAINT licensing_coupon_codes_users_id_fk
        FOREIGN KEY (redeemed_by) REFERENCES users;

ALTER TABLE licensing_credit_subs
    ADD CONSTRAINT licensing_credit_subs_user_id_fk
        FOREIGN KEY (user_id) REFERENCES users;

ALTER TABLE licensing_custom_subs
    ADD CONSTRAINT licensing_custom_subs_users_id_fk
        FOREIGN KEY (user_id) REFERENCES users;

ALTER TABLE licensing_payment_details
    ADD CONSTRAINT licensing_payment_details_users_id_fk
        FOREIGN KEY (user_id) REFERENCES users;

ALTER TABLE licensing_user_subscriptions
    ADD CONSTRAINT licensing_user_subscriptions_users_id_fk
        FOREIGN KEY (user_id) REFERENCES users;

ALTER TABLE notification_settings
    ADD CONSTRAINT notification_settings_user_id_fk
        FOREIGN KEY (user_id) REFERENCES users
            ON DELETE CASCADE;

ALTER TABLE organizations
    ADD CONSTRAINT organization_user_id_pk
        FOREIGN KEY (user_id) REFERENCES users
            ON DELETE CASCADE;

ALTER TABLE personal_todo_list
    ADD CONSTRAINT personal_todo_list_user_id_fk
        FOREIGN KEY (user_id) REFERENCES users;

ALTER TABLE project_categories
    ADD CONSTRAINT project_categories_created_by_fk
        FOREIGN KEY (created_by) REFERENCES users;

ALTER TABLE project_comment_mentions
    ADD CONSTRAINT project_comment_mentions_informed_by_fk
        FOREIGN KEY (informed_by) REFERENCES users;

ALTER TABLE project_comment_mentions
    ADD CONSTRAINT project_comment_mentions_mentioned_by_fk
        FOREIGN KEY (mentioned_by) REFERENCES users;

ALTER TABLE project_comments
    ADD CONSTRAINT project_comments_created_by_fk
        FOREIGN KEY (created_by) REFERENCES users;

ALTER TABLE project_folders
    ADD CONSTRAINT project_folders_created_by_fk
        FOREIGN KEY (created_by) REFERENCES users;

ALTER TABLE project_subscribers
    ADD CONSTRAINT project_subscribers_user_id_fk
        FOREIGN KEY (user_id) REFERENCES users;

ALTER TABLE projects
    ADD CONSTRAINT projects_owner_id_fk
        FOREIGN KEY (owner_id) REFERENCES users;

ALTER TABLE task_activity_logs
    ADD CONSTRAINT task_activity_logs_users_id_fk
        FOREIGN KEY (user_id) REFERENCES users;

ALTER TABLE task_attachments
    ADD CONSTRAINT task_attachments_uploaded_by_fk
        FOREIGN KEY (uploaded_by) REFERENCES users;

ALTER TABLE task_comments
    ADD CONSTRAINT task_comments_user_id_fk
        FOREIGN KEY (user_id) REFERENCES users
            ON DELETE CASCADE;

ALTER TABLE task_subscribers
    ADD CONSTRAINT task_subscribers_user_id_fk
        FOREIGN KEY (user_id) REFERENCES users;

ALTER TABLE task_timers
    ADD CONSTRAINT task_timers_user_id_fk
        FOREIGN KEY (user_id) REFERENCES users
            ON DELETE CASCADE;

ALTER TABLE task_updates
    ADD CONSTRAINT task_updates_reporter_id_fk
        FOREIGN KEY (reporter_id) REFERENCES users
            ON DELETE CASCADE;

ALTER TABLE task_updates
    ADD CONSTRAINT task_updates_user_id_fk
        FOREIGN KEY (user_id) REFERENCES users
            ON DELETE CASCADE;

ALTER TABLE task_work_log
    ADD CONSTRAINT task_work_log_users_id_fk
        FOREIGN KEY (user_id) REFERENCES users
            ON DELETE CASCADE;

ALTER TABLE tasks
    ADD CONSTRAINT tasks_reporter_id_fk
        FOREIGN KEY (reporter_id) REFERENCES users;

ALTER TABLE tasks_assignees
    ADD CONSTRAINT tasks_assignees_assigned_by_fk
        FOREIGN KEY (assigned_by) REFERENCES users;

ALTER TABLE team_members
    ADD CONSTRAINT team_members_user_id_fk
        FOREIGN KEY (user_id) REFERENCES users;

ALTER TABLE users
    ADD CONSTRAINT users_email_check
        CHECK (CHAR_LENGTH((email)::TEXT) <= 255);

ALTER TABLE users
    ADD CONSTRAINT users_name_check
        CHECK (CHAR_LENGTH(name) <= 55);

CREATE TABLE IF NOT EXISTS teams (
    id              UUID                     DEFAULT uuid_generate_v4() NOT NULL,
    name            TEXT                                                NOT NULL,
    user_id         UUID                                                NOT NULL,
    created_at      TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP  NOT NULL,
    updated_at      TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP  NOT NULL,
    organization_id UUID
);

ALTER TABLE teams
    ADD CONSTRAINT teams_pk
        PRIMARY KEY (id);

ALTER TABLE clients
    ADD CONSTRAINT clients_team_id_fk
        FOREIGN KEY (team_id) REFERENCES teams
            ON DELETE CASCADE;

ALTER TABLE cpt_task_statuses
    ADD CONSTRAINT cpt_task_statuses_team_id_fk
        FOREIGN KEY (team_id) REFERENCES teams
            ON DELETE CASCADE;

ALTER TABLE custom_project_templates
    ADD CONSTRAINT custom_project_templates_team_id_fk
        FOREIGN KEY (team_id) REFERENCES teams
            ON DELETE CASCADE;

ALTER TABLE email_invitations
    ADD CONSTRAINT email_invitations_team_id_fk
        FOREIGN KEY (team_id) REFERENCES teams
            ON DELETE CASCADE;

ALTER TABLE job_titles
    ADD CONSTRAINT job_titles_team_id_fk
        FOREIGN KEY (team_id) REFERENCES teams
            ON DELETE CASCADE;

ALTER TABLE notification_settings
    ADD CONSTRAINT notification_settings_team_id_fk
        FOREIGN KEY (team_id) REFERENCES teams
            ON DELETE CASCADE;

ALTER TABLE project_categories
    ADD CONSTRAINT project_categories_team_id_fk
        FOREIGN KEY (team_id) REFERENCES teams
            ON DELETE CASCADE;

ALTER TABLE project_folders
    ADD CONSTRAINT project_folders_team_id_fk
        FOREIGN KEY (team_id) REFERENCES teams;

ALTER TABLE project_logs
    ADD CONSTRAINT project_logs_teams_id_fk
        FOREIGN KEY (team_id) REFERENCES teams
            ON DELETE CASCADE;

ALTER TABLE projects
    ADD CONSTRAINT projects_team_id_fk
        FOREIGN KEY (team_id) REFERENCES teams
            ON DELETE CASCADE;

ALTER TABLE pt_task_statuses
    ADD CONSTRAINT pt_task_statuses_team_id_fk
        FOREIGN KEY (team_id) REFERENCES teams
            ON DELETE CASCADE;

ALTER TABLE task_activity_logs
    ADD CONSTRAINT task_activity_logs_team_id_fk
        FOREIGN KEY (team_id) REFERENCES teams
            ON DELETE CASCADE;

ALTER TABLE task_attachments
    ADD CONSTRAINT task_attachments_team_id_fk
        FOREIGN KEY (team_id) REFERENCES teams
            ON DELETE CASCADE;

ALTER TABLE team_labels
    ADD CONSTRAINT team_labels_team_id_fk
        FOREIGN KEY (team_id) REFERENCES teams
            ON DELETE CASCADE;

ALTER TABLE task_statuses
    ADD CONSTRAINT task_statuses_team_id_fk
        FOREIGN KEY (team_id) REFERENCES teams
            ON DELETE CASCADE;

ALTER TABLE task_templates
    ADD CONSTRAINT task_templates_teams_id_fk
        FOREIGN KEY (team_id) REFERENCES teams
            ON DELETE CASCADE;

ALTER TABLE task_updates
    ADD CONSTRAINT task_updates_team_id_fk
        FOREIGN KEY (team_id) REFERENCES teams
            ON DELETE CASCADE;

ALTER TABLE team_members
    ADD CONSTRAINT team_members_team_id_fk
        FOREIGN KEY (team_id) REFERENCES teams
            ON DELETE CASCADE;

ALTER TABLE users
    ADD CONSTRAINT users_active_team_fk
        FOREIGN KEY (active_team) REFERENCES teams;

ALTER TABLE teams
    ADD CONSTRAINT team_organization_id_pk
        FOREIGN KEY (organization_id) REFERENCES organizations;

ALTER TABLE teams
    ADD CONSTRAINT teams_user_id_fk
        FOREIGN KEY (user_id) REFERENCES users;

ALTER TABLE teams
    ADD CONSTRAINT teams_name_check
        CHECK (CHAR_LENGTH(name) <= 55);

CREATE TABLE IF NOT EXISTS timezones (
    id         UUID DEFAULT uuid_generate_v4() NOT NULL,
    name       TEXT                            NOT NULL,
    abbrev     TEXT                            NOT NULL,
    utc_offset INTERVAL                        NOT NULL
);

ALTER TABLE timezones
    ADD CONSTRAINT timezones_pk
        PRIMARY KEY (id);

ALTER TABLE users
    ADD CONSTRAINT users_timezone_id_fk
        FOREIGN KEY (timezone_id) REFERENCES timezones;

CREATE TABLE IF NOT EXISTS user_notifications (
    id         UUID                     DEFAULT uuid_generate_v4() NOT NULL,
    message    TEXT                                                NOT NULL,
    user_id    UUID                                                NOT NULL,
    team_id    UUID                                                NOT NULL,
    read       BOOLEAN                  DEFAULT FALSE              NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP  NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP  NOT NULL,
    task_id    UUID,
    project_id UUID
);

ALTER TABLE user_notifications
    ADD CONSTRAINT user_notifications_pk
        PRIMARY KEY (id);

ALTER TABLE user_notifications
    ADD CONSTRAINT user_notifications_project_id_fk
        FOREIGN KEY (project_id) REFERENCES projects
            ON DELETE CASCADE;

ALTER TABLE user_notifications
    ADD CONSTRAINT user_notifications_task_id_fk
        FOREIGN KEY (task_id) REFERENCES tasks
            ON DELETE CASCADE;

ALTER TABLE user_notifications
    ADD CONSTRAINT user_notifications_team_id_fk
        FOREIGN KEY (team_id) REFERENCES teams
            ON DELETE CASCADE;

ALTER TABLE user_notifications
    ADD CONSTRAINT user_notifications_user_id_fk
        FOREIGN KEY (user_id) REFERENCES users;

CREATE TABLE IF NOT EXISTS users_data (
    user_id                  UUID                           NOT NULL,
    organization_name        TEXT                           NOT NULL,
    contact_number           TEXT,
    contact_number_secondary TEXT,
    address_line_1           TEXT,
    address_line_2           TEXT,
    country                  UUID,
    city                     TEXT,
    state                    TEXT,
    postal_code              TEXT,
    trial_in_progress        BOOLEAN DEFAULT FALSE          NOT NULL,
    trial_expire_date        DATE,
    subscription_status      TEXT    DEFAULT 'active'::TEXT NOT NULL,
    storage                  INTEGER DEFAULT 1              NOT NULL,
    updating_plan            BOOLEAN DEFAULT FALSE
);

ALTER TABLE users_data
    ADD UNIQUE (user_id);

ALTER TABLE users_data
    ADD CONSTRAINT users_data_user_id_fk
        FOREIGN KEY (user_id) REFERENCES users
            ON DELETE CASCADE;

ALTER TABLE users_data
    ADD CONSTRAINT users_data_users_id_fk
        FOREIGN KEY (user_id) REFERENCES users;

CREATE TABLE IF NOT EXISTS worklenz_alerts (
    description TEXT NOT NULL,
    type        TEXT NOT NULL,
    active      BOOLEAN DEFAULT FALSE
);

ALTER TABLE worklenz_alerts
    ADD CONSTRAINT worklenz_alerts_type_check
        CHECK (type = ANY (ARRAY ['success'::TEXT, 'info'::TEXT, 'warning'::TEXT, 'error'::TEXT]));

CREATE TABLE IF NOT EXISTS licensing_coupon_logs (
    id          UUID                     DEFAULT uuid_generate_v4() NOT NULL,
    coupon_code TEXT                                                NOT NULL,
    redeemed_by UUID                                                NOT NULL,
    redeemed_at TIMESTAMP WITH TIME ZONE                            NOT NULL,
    is_refunded BOOLEAN                  DEFAULT TRUE               NOT NULL,
    reason      TEXT,
    reverted_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    feedback    TEXT
);

ALTER TABLE licensing_coupon_logs
    ADD CONSTRAINT licensing_coupon_logs_pk
        PRIMARY KEY (id);

ALTER TABLE licensing_coupon_logs
    ADD CONSTRAINT licensing_coupon_logs_users_id_fk
        FOREIGN KEY (redeemed_by) REFERENCES users;

CREATE TABLE IF NOT EXISTS sys_license_types (
    id          UUID DEFAULT uuid_generate_v4() NOT NULL,
    name        TEXT                            NOT NULL,
    key         TEXT                            NOT NULL,
    description TEXT
);

ALTER TABLE sys_license_types
    ADD PRIMARY KEY (id);

CREATE TABLE IF NOT EXISTS task_comment_mentions (
    comment_id      UUID                                               NOT NULL,
    mentioned_index INTEGER                  DEFAULT 0                 NOT NULL,
    mentioned_by    UUID                                               NOT NULL,
    informed_by     UUID                                               NOT NULL,
    created_at      TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP NOT NULL
);

ALTER TABLE task_comment_mentions
    ADD CONSTRAINT task_comment_mentions_comment_id_fk
        FOREIGN KEY (comment_id) REFERENCES task_comments
            ON DELETE CASCADE;

ALTER TABLE task_comment_mentions
    ADD CONSTRAINT task_comment_mentions_mentioned_by_fk
        FOREIGN KEY (mentioned_by) REFERENCES users;

ALTER TABLE task_comment_mentions
    ADD CONSTRAINT task_comment_mentions_informed_by_fk
        FOREIGN KEY (informed_by) REFERENCES team_members
            ON DELETE CASCADE;

CREATE TABLE IF NOT EXISTS email_logs (
    id         UUID                     DEFAULT uuid_generate_v4() NOT NULL,
    email      TEXT                                                NOT NULL,
    subject    TEXT                                                NOT NULL,
    html       TEXT                                                NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS task_comment_reactions (
    id             UUID                     DEFAULT uuid_generate_v4()     NOT NULL,
    comment_id     UUID                                                    NOT NULL,
    user_id        UUID                                                    NOT NULL,
    team_member_id UUID                                                    NOT NULL,
    reaction_type  REACTION_TYPES           DEFAULT 'like'::REACTION_TYPES NOT NULL,
    created_at     TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

ALTER TABLE task_comment_reactions
    ADD CONSTRAINT task_comment_reactions_pk
        PRIMARY KEY (id);

ALTER TABLE task_comment_reactions
    ADD CONSTRAINT task_comment_reactions_user_id_fk
        FOREIGN KEY (user_id) REFERENCES users;

ALTER TABLE task_comment_reactions
    ADD CONSTRAINT task_comment_reactions_comment_id_fk
        FOREIGN KEY (comment_id) REFERENCES task_comments
            ON DELETE CASCADE;

ALTER TABLE task_comment_reactions
    ADD CONSTRAINT task_comment_reactions_team_member_id_fk
        FOREIGN KEY (team_member_id) REFERENCES team_members
            ON DELETE CASCADE;

CREATE TABLE IF NOT EXISTS task_dependencies (
    id              UUID                     DEFAULT uuid_generate_v4()            NOT NULL,
    task_id         UUID                                                           NOT NULL,
    related_task_id UUID                                                           NOT NULL,
    dependency_type DEPENDENCY_TYPE          DEFAULT 'blocked_by'::DEPENDENCY_TYPE NOT NULL,
    created_at      TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

ALTER TABLE task_dependencies
    ADD CONSTRAINT task_dependencies_pk
        PRIMARY KEY (id);

ALTER TABLE task_dependencies
    ADD CONSTRAINT task_dependencies_unique_key
        UNIQUE (task_id, related_task_id, dependency_type);

ALTER TABLE task_dependencies
    ADD CONSTRAINT task_dependencies_tasks_id_fk
        FOREIGN KEY (task_id) REFERENCES tasks
            ON DELETE CASCADE;

ALTER TABLE task_dependencies
    ADD CONSTRAINT task_dependencies_tasks_id_fk_2
        FOREIGN KEY (related_task_id) REFERENCES tasks
            ON DELETE CASCADE;

CREATE TABLE IF NOT EXISTS task_recurring_schedules (
    id              UUID                     DEFAULT uuid_generate_v4() NOT NULL,
    schedule_type   SCHEDULE_TYPE            DEFAULT 'daily'::SCHEDULE_TYPE,
    days_of_week    INTEGER[],
    day_of_month    INTEGER,
    week_of_month   INTEGER,
    interval_days   INTEGER,
    interval_weeks  INTEGER,
    interval_months INTEGER,
    start_date      DATE,
    end_date        DATE,
    created_at      TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

ALTER TABLE task_recurring_schedules
    ADD CONSTRAINT task_recurring_schedules_pk
        PRIMARY KEY (id);

CREATE TABLE IF NOT EXISTS task_recurring_templates (
    id          UUID                     DEFAULT uuid_generate_v4() NOT NULL,
    task_id     UUID                                                NOT NULL,
    schedule_id UUID                                                NOT NULL,
    name        TEXT                                                NOT NULL,
    description TEXT,
    end_date    TIMESTAMP WITH TIME ZONE,
    priority_id UUID                                                NOT NULL,
    project_id  UUID                                                NOT NULL,
    assignees   JSONB,
    labels      JSONB,
    created_at  TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

ALTER TABLE task_recurring_templates
    ADD CONSTRAINT task_recurring_templates_projects_id_fk
        FOREIGN KEY (project_id) REFERENCES projects
            ON DELETE CASCADE;

ALTER TABLE task_recurring_templates
    ADD CONSTRAINT task_recurring_templates_task_priorities_id_fk
        FOREIGN KEY (priority_id) REFERENCES task_priorities;

ALTER TABLE task_recurring_templates
    ADD CONSTRAINT task_recurring_templates_task_recurring_schedules_id_fk
        FOREIGN KEY (schedule_id) REFERENCES task_recurring_schedules
            ON DELETE CASCADE;

ALTER TABLE task_recurring_templates
    ADD CONSTRAINT task_recurring_templates_tasks_id_fk
        FOREIGN KEY (task_id) REFERENCES tasks
            ON DELETE CASCADE;

CREATE TABLE IF NOT EXISTS task_comment_attachments (
    id         UUID                     DEFAULT uuid_generate_v4() NOT NULL,
    name       TEXT                                                NOT NULL,
    size       BIGINT                   DEFAULT 0                  NOT NULL,
    type       TEXT                                                NOT NULL,
    task_id    UUID                                                NOT NULL,
    comment_id UUID                                                NOT NULL,
    team_id    UUID                                                NOT NULL,
    project_id UUID                                                NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP  NOT NULL
);

ALTER TABLE task_comment_attachments
    ADD CONSTRAINT task_comment_attachments_pk
        PRIMARY KEY (id);

ALTER TABLE task_comment_attachments
    ADD CONSTRAINT task_comment_attachments_comment_id_fk
        FOREIGN KEY (comment_id) REFERENCES task_comments
            ON DELETE CASCADE;

ALTER TABLE task_comment_attachments
    ADD CONSTRAINT task_comment_attachments_project_id_fk
        FOREIGN KEY (project_id) REFERENCES projects
            ON DELETE CASCADE;

ALTER TABLE task_comment_attachments
    ADD CONSTRAINT task_comment_attachments_task_id_fk
        FOREIGN KEY (task_id) REFERENCES tasks
            ON DELETE CASCADE;

ALTER TABLE task_comment_attachments
    ADD CONSTRAINT task_comment_attachments_team_id_fk
        FOREIGN KEY (team_id) REFERENCES teams
            ON DELETE CASCADE;

ALTER TABLE task_comment_attachments
    ADD CONSTRAINT task_comment_attachments_name_check
        CHECK (CHAR_LENGTH(name) <= 100);

CREATE TABLE IF NOT EXISTS cc_custom_columns (
    id               UUID                     DEFAULT uuid_generate_v4() NOT NULL,
    project_id       UUID                                                NOT NULL,
    name             TEXT                                                NOT NULL,
    key              TEXT                                                NOT NULL,
    field_type       TEXT                                                NOT NULL,
    width            INTEGER                  DEFAULT 150,
    is_visible       BOOLEAN                  DEFAULT TRUE,
    is_custom_column BOOLEAN                  DEFAULT TRUE,
    created_at       TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at       TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

ALTER TABLE cc_custom_columns
    ADD PRIMARY KEY (id);

ALTER TABLE cc_custom_columns
    ADD UNIQUE (project_id, key);

ALTER TABLE cc_custom_columns
    ADD FOREIGN KEY (project_id) REFERENCES projects
        ON DELETE CASCADE;

CREATE TABLE IF NOT EXISTS cc_column_configurations (
    id                        UUID                     DEFAULT uuid_generate_v4() NOT NULL,
    column_id                 UUID                                                NOT NULL,
    field_title               TEXT,
    field_type                TEXT,
    number_type               TEXT,
    decimals                  INTEGER,
    label                     TEXT,
    label_position            TEXT,
    preview_value             TEXT,
    expression                TEXT,
    first_numeric_column_key  TEXT,
    second_numeric_column_key TEXT,
    created_at                TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at                TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

ALTER TABLE cc_column_configurations
    ADD PRIMARY KEY (id);

ALTER TABLE cc_column_configurations
    ADD FOREIGN KEY (column_id) REFERENCES cc_custom_columns
        ON DELETE CASCADE;

CREATE TABLE IF NOT EXISTS cc_selection_options (
    id              UUID                     DEFAULT uuid_generate_v4() NOT NULL,
    column_id       UUID                                                NOT NULL,
    selection_id    TEXT                                                NOT NULL,
    selection_name  TEXT                                                NOT NULL,
    selection_color TEXT,
    selection_order INTEGER                                             NOT NULL,
    created_at      TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at      TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

ALTER TABLE cc_selection_options
    ADD PRIMARY KEY (id);

ALTER TABLE cc_selection_options
    ADD FOREIGN KEY (column_id) REFERENCES cc_custom_columns
        ON DELETE CASCADE;

CREATE TABLE IF NOT EXISTS cc_label_options (
    id          UUID                     DEFAULT uuid_generate_v4() NOT NULL,
    column_id   UUID                                                NOT NULL,
    label_id    TEXT                                                NOT NULL,
    label_name  TEXT                                                NOT NULL,
    label_color TEXT,
    label_order INTEGER                                             NOT NULL,
    created_at  TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at  TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

ALTER TABLE cc_label_options
    ADD PRIMARY KEY (id);

ALTER TABLE cc_label_options
    ADD FOREIGN KEY (column_id) REFERENCES cc_custom_columns
        ON DELETE CASCADE;

CREATE TABLE IF NOT EXISTS cc_column_values (
    id            UUID                     DEFAULT uuid_generate_v4() NOT NULL,
    task_id       UUID                                                NOT NULL,
    column_id     UUID                                                NOT NULL,
    text_value    TEXT,
    number_value  NUMERIC(18, 6),
    date_value    TIMESTAMP WITH TIME ZONE,
    boolean_value BOOLEAN,
    json_value    JSONB,
    created_at    TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at    TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

ALTER TABLE cc_column_values
    ADD PRIMARY KEY (id);

ALTER TABLE cc_column_values
    ADD UNIQUE (task_id, column_id);

ALTER TABLE cc_column_values
    ADD FOREIGN KEY (task_id) REFERENCES tasks
        ON DELETE CASCADE;

ALTER TABLE cc_column_values
    ADD FOREIGN KEY (column_id) REFERENCES cc_custom_columns
        ON DELETE CASCADE;

CREATE TABLE IF NOT EXISTS organization_working_days (
    id              UUID                     DEFAULT uuid_generate_v4() NOT NULL,
    monday          BOOLEAN                  DEFAULT TRUE               NOT NULL,
    tuesday         BOOLEAN                  DEFAULT TRUE               NOT NULL,
    wednesday       BOOLEAN                  DEFAULT TRUE               NOT NULL,
    thursday        BOOLEAN                  DEFAULT TRUE               NOT NULL,
    friday          BOOLEAN                  DEFAULT TRUE               NOT NULL,
    saturday        BOOLEAN                  DEFAULT FALSE              NOT NULL,
    sunday          BOOLEAN                  DEFAULT FALSE              NOT NULL,
    organization_id UUID                                                NOT NULL,
    created_at      TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP  NOT NULL,
    updated_at      TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP  NOT NULL
);

ALTER TABLE organization_working_days
    ADD CONSTRAINT organization_working_days_pk
        PRIMARY KEY (id);

ALTER TABLE organization_working_days
    ADD CONSTRAINT org_organization_id_fk
        FOREIGN KEY (organization_id) REFERENCES organizations;

-- Survey tables for account setup questionnaire
CREATE TABLE IF NOT EXISTS surveys (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(255) NOT NULL,
    description TEXT,
    survey_type VARCHAR(50) DEFAULT 'account_setup' NOT NULL,
    is_active BOOLEAN DEFAULT TRUE NOT NULL,
    created_at TIMESTAMP DEFAULT now() NOT NULL,
    updated_at TIMESTAMP DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS survey_questions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    survey_id UUID REFERENCES surveys(id) ON DELETE CASCADE NOT NULL,
    question_key VARCHAR(100) NOT NULL,
    question_type VARCHAR(50) NOT NULL,
    is_required BOOLEAN DEFAULT FALSE NOT NULL,
    sort_order INTEGER DEFAULT 0 NOT NULL,
    options JSONB,
    created_at TIMESTAMP DEFAULT now() NOT NULL,
    updated_at TIMESTAMP DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS survey_responses (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    survey_id UUID REFERENCES surveys(id) ON DELETE CASCADE NOT NULL,
    user_id UUID REFERENCES users(id) ON DELETE CASCADE NOT NULL,
    is_completed BOOLEAN DEFAULT FALSE NOT NULL,
    started_at TIMESTAMP DEFAULT now() NOT NULL,
    completed_at TIMESTAMP,
    created_at TIMESTAMP DEFAULT now() NOT NULL,
    updated_at TIMESTAMP DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS survey_answers (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    response_id UUID REFERENCES survey_responses(id) ON DELETE CASCADE NOT NULL,
    question_id UUID REFERENCES survey_questions(id) ON DELETE CASCADE NOT NULL,
    answer_text TEXT,
    answer_json JSONB,
    created_at TIMESTAMP DEFAULT now() NOT NULL,
    updated_at TIMESTAMP DEFAULT now() NOT NULL
);

-- Survey table indexes
CREATE INDEX IF NOT EXISTS idx_surveys_type_active ON surveys(survey_type, is_active);
CREATE INDEX IF NOT EXISTS idx_survey_questions_survey_order ON survey_questions(survey_id, sort_order);
CREATE INDEX IF NOT EXISTS idx_survey_responses_user_survey ON survey_responses(user_id, survey_id);
CREATE INDEX IF NOT EXISTS idx_survey_responses_completed ON survey_responses(survey_id, is_completed);
CREATE INDEX IF NOT EXISTS idx_survey_answers_response ON survey_answers(response_id);

-- Survey table constraints
ALTER TABLE survey_questions ADD CONSTRAINT survey_questions_sort_order_check CHECK (sort_order >= 0);
ALTER TABLE survey_questions ADD CONSTRAINT survey_questions_type_check CHECK (question_type IN ('single_choice', 'multiple_choice', 'text'));
ALTER TABLE survey_responses ADD CONSTRAINT unique_user_survey_response UNIQUE (user_id, survey_id);
ALTER TABLE survey_answers ADD CONSTRAINT unique_response_question_answer UNIQUE (response_id, question_id);
