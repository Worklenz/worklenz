'use strict';
// Converted from: database/migrations/20250728000000-add-organization-holiday-settings.sql

/** @type {import('node-pg-migrate').ColumnDefinitions | undefined} */
exports.shorthands = undefined;

/** @param {import('node-pg-migrate').MigrationBuilder} pgm */
exports.up = async (pgm) => {
  pgm.sql(`
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

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint 
        WHERE conrelid = 'organization_holiday_settings'::regclass AND contype = 'p'
    ) THEN
        ALTER TABLE organization_holiday_settings ADD CONSTRAINT organization_holiday_settings_pk PRIMARY KEY (id);
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint 
        WHERE conrelid = 'organization_holiday_settings'::regclass AND conname = 'organization_holiday_settings_organization_id_fk'
    ) THEN
        ALTER TABLE organization_holiday_settings ADD CONSTRAINT organization_holiday_settings_organization_id_fk
            FOREIGN KEY (organization_id) REFERENCES organizations ON DELETE CASCADE;
    END IF;

    BEGIN
        IF NOT EXISTS (
            SELECT 1 FROM pg_constraint 
            WHERE conrelid = 'organization_holiday_settings'::regclass AND conname = 'organization_holiday_settings_country_code_fk'
        ) THEN
            ALTER TABLE organization_holiday_settings ADD CONSTRAINT organization_holiday_settings_country_code_fk
                FOREIGN KEY (country_code) REFERENCES countries(code) ON DELETE SET NULL;
        END IF;
    EXCEPTION
        WHEN others THEN NULL;
    END;

    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint 
        WHERE conrelid = 'organization_holiday_settings'::regclass AND conname = 'organization_holiday_settings_organization_unique'
    ) THEN
        ALTER TABLE organization_holiday_settings ADD CONSTRAINT organization_holiday_settings_organization_unique
            UNIQUE (organization_id);
    END IF;
END $$;

-- CREATE INDEX IF NOT EXISTS for better performance
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

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint 
        WHERE conrelid = 'state_holidays'::regclass AND contype = 'p'
    ) THEN
        ALTER TABLE state_holidays ADD CONSTRAINT state_holidays_pk PRIMARY KEY (id);
    END IF;

    BEGIN
        IF NOT EXISTS (
            SELECT 1 FROM pg_constraint 
            WHERE conrelid = 'state_holidays'::regclass AND conname = 'state_holidays_country_code_fk'
        ) THEN
            ALTER TABLE state_holidays ADD CONSTRAINT state_holidays_country_code_fk
                FOREIGN KEY (country_code) REFERENCES countries(code) ON DELETE CASCADE;
        END IF;
    EXCEPTION
        WHEN others THEN NULL;
    END;

    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint 
        WHERE conrelid = 'state_holidays'::regclass AND conname = 'state_holidays_state_name_date_unique'
    ) THEN
        ALTER TABLE state_holidays ADD CONSTRAINT state_holidays_state_name_date_unique
            UNIQUE (country_code, state_code, name, date);
    END IF;
END $$;

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_state_holidays_country_state ON state_holidays(country_code, state_code);
CREATE INDEX IF NOT EXISTS idx_state_holidays_date ON state_holidays(date);
  `);
};

/** @param {import('node-pg-migrate').MigrationBuilder} pgm */
exports.down = async (_pgm) => {
  // This migration is a DDL/function change — no automatic rollback defined.
  // Review manually before running migrate:down.
};
