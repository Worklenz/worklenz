'use strict';
// Converted from: database/migrations/20250130000000-add-holiday-calendar.sql

/** @type {import('node-pg-migrate').ColumnDefinitions | undefined} */
exports.shorthands = undefined;

/** @param {import('node-pg-migrate').MigrationBuilder} pgm */
exports.up = async (pgm) => {
  pgm.sql(`
-- Create holiday types table
CREATE TABLE IF NOT EXISTS holiday_types (
    id          UUID                     DEFAULT uuid_generate_v4() NOT NULL,
    name        TEXT                                                NOT NULL,
    description TEXT,
    color_code  WL_HEX_COLOR                                        NOT NULL,
    created_at  TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP  NOT NULL,
    updated_at  TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP  NOT NULL
);

-- Create organization holidays table
CREATE TABLE IF NOT EXISTS organization_holidays (
    id              UUID                     DEFAULT uuid_generate_v4() NOT NULL,
    organization_id UUID                                                NOT NULL,
    holiday_type_id UUID                                                NOT NULL,
    name            TEXT                                                NOT NULL,
    description     TEXT,
    date            DATE                                                NOT NULL,
    is_recurring    BOOLEAN                  DEFAULT FALSE              NOT NULL,
    created_at      TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP  NOT NULL,
    updated_at      TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP  NOT NULL
);

-- Create country holidays table for predefined holidays
CREATE TABLE IF NOT EXISTS country_holidays (
    id          UUID                     DEFAULT uuid_generate_v4() NOT NULL,
    country_code CHAR(2)                                            NOT NULL,
    name        TEXT                                                NOT NULL,
    description TEXT,
    date        DATE                                                NOT NULL,
    is_recurring BOOLEAN                 DEFAULT TRUE               NOT NULL,
    created_at  TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP  NOT NULL,
    updated_at  TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP  NOT NULL
);

-- Ensure countries has a unique constraint on code for foreign key reference
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conrelid = 'countries'::regclass AND conname = 'countries_code_unique') THEN
        ALTER TABLE countries ADD CONSTRAINT countries_code_unique UNIQUE (code);
    END IF;
END $$;

DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conrelid = 'holiday_types'::regclass AND conname = 'holiday_types_pk') THEN
        ALTER TABLE holiday_types ADD CONSTRAINT holiday_types_pk PRIMARY KEY (id);
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conrelid = 'organization_holidays'::regclass AND conname = 'organization_holidays_pk') THEN
        ALTER TABLE organization_holidays ADD CONSTRAINT organization_holidays_pk PRIMARY KEY (id);
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conrelid = 'organization_holidays'::regclass AND conname = 'organization_holidays_organization_id_fk') THEN
        ALTER TABLE organization_holidays ADD CONSTRAINT organization_holidays_organization_id_fk
            FOREIGN KEY (organization_id) REFERENCES organizations ON DELETE CASCADE;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conrelid = 'organization_holidays'::regclass AND conname = 'organization_holidays_holiday_type_id_fk') THEN
        ALTER TABLE organization_holidays ADD CONSTRAINT organization_holidays_holiday_type_id_fk
            FOREIGN KEY (holiday_type_id) REFERENCES holiday_types ON DELETE RESTRICT;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conrelid = 'organization_holidays'::regclass AND conname = 'organization_holidays_organization_date_unique') THEN
        ALTER TABLE organization_holidays ADD CONSTRAINT organization_holidays_organization_date_unique
            UNIQUE (organization_id, date);
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conrelid = 'country_holidays'::regclass AND conname = 'country_holidays_pk') THEN
        ALTER TABLE country_holidays ADD CONSTRAINT country_holidays_pk PRIMARY KEY (id);
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conrelid = 'country_holidays'::regclass AND conname = 'country_holidays_country_code_fk') THEN
        ALTER TABLE country_holidays ADD CONSTRAINT country_holidays_country_code_fk
            FOREIGN KEY (country_code) REFERENCES countries(code) ON DELETE CASCADE;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conrelid = 'country_holidays'::regclass AND conname = 'country_holidays_country_name_date_unique') THEN
        ALTER TABLE country_holidays ADD CONSTRAINT country_holidays_country_name_date_unique
            UNIQUE (country_code, name, date);
    END IF;
END $$;

-- Insert default holiday types
INSERT INTO holiday_types (name, description, color_code) VALUES
    ('Public Holiday', 'Official public holidays', '#f37070'),
    ('Company Holiday', 'Company-specific holidays', '#70a6f3'),
    ('Personal Holiday', 'Personal or optional holidays', '#75c997'),
    ('Religious Holiday', 'Religious observances', '#fbc84c')
ON CONFLICT DO NOTHING;

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_organization_holidays_organization_id ON organization_holidays(organization_id);
CREATE INDEX IF NOT EXISTS idx_organization_holidays_date ON organization_holidays(date);
CREATE INDEX IF NOT EXISTS idx_country_holidays_country_code ON country_holidays(country_code);
CREATE INDEX IF NOT EXISTS idx_country_holidays_date ON country_holidays(date);
  `);
};

/** @param {import('node-pg-migrate').MigrationBuilder} pgm */
exports.down = async (_pgm) => {
  // This migration is a DDL/function change — no automatic rollback defined.
  // Review manually before running migrate:down.
};
