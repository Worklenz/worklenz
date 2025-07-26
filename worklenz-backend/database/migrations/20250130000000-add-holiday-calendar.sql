-- Create holiday types table
CREATE TABLE IF NOT EXISTS holiday_types (
    id          UUID                     DEFAULT uuid_generate_v4() NOT NULL,
    name        TEXT                                                NOT NULL,
    description TEXT,
    color_code  WL_HEX_COLOR                                        NOT NULL,
    created_at  TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP  NOT NULL,
    updated_at  TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP  NOT NULL
);

ALTER TABLE holiday_types
    ADD CONSTRAINT holiday_types_pk
        PRIMARY KEY (id);

-- Insert default holiday types
INSERT INTO holiday_types (name, description, color_code) VALUES
    ('Public Holiday', 'Official public holidays', '#f37070'),
    ('Company Holiday', 'Company-specific holidays', '#70a6f3'),
    ('Personal Holiday', 'Personal or optional holidays', '#75c997'),
    ('Religious Holiday', 'Religious observances', '#fbc84c')
ON CONFLICT DO NOTHING;

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

ALTER TABLE organization_holidays
    ADD CONSTRAINT organization_holidays_pk
        PRIMARY KEY (id);

ALTER TABLE organization_holidays
    ADD CONSTRAINT organization_holidays_organization_id_fk
        FOREIGN KEY (organization_id) REFERENCES organizations
            ON DELETE CASCADE;

ALTER TABLE organization_holidays
    ADD CONSTRAINT organization_holidays_holiday_type_id_fk
        FOREIGN KEY (holiday_type_id) REFERENCES holiday_types
            ON DELETE RESTRICT;

-- Add unique constraint to prevent duplicate holidays on the same date for an organization
ALTER TABLE organization_holidays
    ADD CONSTRAINT organization_holidays_organization_date_unique
        UNIQUE (organization_id, date);

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

ALTER TABLE country_holidays
    ADD CONSTRAINT country_holidays_pk
        PRIMARY KEY (id);

ALTER TABLE country_holidays
    ADD CONSTRAINT country_holidays_country_code_fk
        FOREIGN KEY (country_code) REFERENCES countries(code)
            ON DELETE CASCADE;

-- Add unique constraint to prevent duplicate holidays for the same country, name, and date
ALTER TABLE country_holidays
    ADD CONSTRAINT country_holidays_country_name_date_unique
        UNIQUE (country_code, name, date);

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_organization_holidays_organization_id ON organization_holidays(organization_id);
CREATE INDEX IF NOT EXISTS idx_organization_holidays_date ON organization_holidays(date);
CREATE INDEX IF NOT EXISTS idx_country_holidays_country_code ON country_holidays(country_code);
CREATE INDEX IF NOT EXISTS idx_country_holidays_date ON country_holidays(date); 