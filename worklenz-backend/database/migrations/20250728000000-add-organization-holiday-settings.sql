-- Create organization holiday settings table
CREATE TABLE IF NOT EXISTS organization_holiday_settings (
    id              UUID                     DEFAULT uuid_generate_v4() NOT NULL,
    organization_id UUID                                                NOT NULL,
    country_code    CHAR(2),
    state_code      TEXT,
    auto_sync_holidays BOOLEAN               DEFAULT TRUE               NOT NULL,
    created_at      TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP  NOT NULL,
    updated_at      TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP  NOT NULL
);

ALTER TABLE organization_holiday_settings
    ADD CONSTRAINT organization_holiday_settings_pk
        PRIMARY KEY (id);

ALTER TABLE organization_holiday_settings
    ADD CONSTRAINT organization_holiday_settings_organization_id_fk
        FOREIGN KEY (organization_id) REFERENCES organizations
            ON DELETE CASCADE;

ALTER TABLE organization_holiday_settings
    ADD CONSTRAINT organization_holiday_settings_country_code_fk
        FOREIGN KEY (country_code) REFERENCES countries(code)
            ON DELETE SET NULL;

-- Ensure one settings record per organization
ALTER TABLE organization_holiday_settings
    ADD CONSTRAINT organization_holiday_settings_organization_unique
        UNIQUE (organization_id);

-- Create index for better performance
CREATE INDEX IF NOT EXISTS idx_organization_holiday_settings_organization_id ON organization_holiday_settings(organization_id);

-- Add state holidays table for more granular holiday data
CREATE TABLE IF NOT EXISTS state_holidays (
    id          UUID                     DEFAULT uuid_generate_v4() NOT NULL,
    country_code CHAR(2)                                            NOT NULL,
    state_code  TEXT                                                NOT NULL,
    name        TEXT                                                NOT NULL,
    description TEXT,
    date        DATE                                                NOT NULL,
    is_recurring BOOLEAN                 DEFAULT TRUE               NOT NULL,
    created_at  TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP  NOT NULL,
    updated_at  TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP  NOT NULL
);

ALTER TABLE state_holidays
    ADD CONSTRAINT state_holidays_pk
        PRIMARY KEY (id);

ALTER TABLE state_holidays
    ADD CONSTRAINT state_holidays_country_code_fk
        FOREIGN KEY (country_code) REFERENCES countries(code)
            ON DELETE CASCADE;

-- Add unique constraint to prevent duplicate holidays for the same state, name, and date
ALTER TABLE state_holidays
    ADD CONSTRAINT state_holidays_state_name_date_unique
        UNIQUE (country_code, state_code, name, date);

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_state_holidays_country_state ON state_holidays(country_code, state_code);
CREATE INDEX IF NOT EXISTS idx_state_holidays_date ON state_holidays(date);