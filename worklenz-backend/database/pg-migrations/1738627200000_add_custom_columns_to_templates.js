'use strict';
// Converted from: database/migrations/20250204000000-add-custom-columns-to-templates.sql

/** @type {import('node-pg-migrate').ColumnDefinitions | undefined} */
exports.shorthands = undefined;

/** @param {import('node-pg-migrate').MigrationBuilder} pgm */
exports.up = async (pgm) => {
  pgm.sql(`
-- Migration script for adding custom column support to project templates
-- This script creates tables to store custom column configurations with project templates

-- 1. CREATE TABLE IF NOT EXISTS for template custom columns
CREATE TABLE IF NOT EXISTS cpt_custom_columns (
    id               UUID                     DEFAULT uuid_generate_v4() NOT NULL,
    template_id      UUID                                                NOT NULL,
    name             TEXT                                                NOT NULL,
    key              TEXT                                                NOT NULL,
    field_type       TEXT                                                NOT NULL,
    width            INTEGER                  DEFAULT 150,
    is_visible       BOOLEAN                  DEFAULT TRUE,
    is_custom_column BOOLEAN                  DEFAULT TRUE,
    sort_order       INTEGER                  DEFAULT 0,
    created_at       TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at       TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

ALTER TABLE cpt_custom_columns
    ADD PRIMARY KEY (id);

ALTER TABLE cpt_custom_columns
    ADD UNIQUE (template_id, key);

ALTER TABLE cpt_custom_columns
    ADD FOREIGN KEY (template_id) REFERENCES custom_project_templates
        ON DELETE CASCADE;

-- 2. CREATE TABLE IF NOT EXISTS for column configurations
CREATE TABLE IF NOT EXISTS cpt_column_configurations (
    id                        UUID                     DEFAULT uuid_generate_v4() NOT NULL,
    column_id                 UUID                                                NOT NULL,
    field_title               TEXT,
    field_type                TEXT,
    number_type               TEXT,
    decimals                  INTEGER,
    label                     TEXT,
    label_position            TEXT,
    expression                TEXT,
    first_numeric_column_id   UUID,
    second_numeric_column_id  UUID,
    created_at                TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at                TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

ALTER TABLE cpt_column_configurations
    ADD PRIMARY KEY (id);

ALTER TABLE cpt_column_configurations
    ADD FOREIGN KEY (column_id) REFERENCES cpt_custom_columns
        ON DELETE CASCADE;

-- 3. CREATE TABLE IF NOT EXISTS for selection options (dropdown/select columns)
CREATE TABLE IF NOT EXISTS cpt_selection_options (
    id              UUID                     DEFAULT uuid_generate_v4() NOT NULL,
    column_id       UUID                                                NOT NULL,
    selection_id    TEXT                                                NOT NULL,
    selection_name  TEXT                                                NOT NULL,
    selection_color TEXT,
    selection_order INTEGER                                             NOT NULL,
    created_at      TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at      TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

ALTER TABLE cpt_selection_options
    ADD PRIMARY KEY (id);

ALTER TABLE cpt_selection_options
    ADD FOREIGN KEY (column_id) REFERENCES cpt_custom_columns
        ON DELETE CASCADE;

-- 4. CREATE TABLE IF NOT EXISTS for label options (label columns)
CREATE TABLE IF NOT EXISTS cpt_label_options (
    id          UUID                     DEFAULT uuid_generate_v4() NOT NULL,
    column_id   UUID                                                NOT NULL,
    label_id    TEXT                                                NOT NULL,
    label_name  TEXT                                                NOT NULL,
    label_color TEXT,
    label_order INTEGER                                             NOT NULL,
    created_at  TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at  TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

ALTER TABLE cpt_label_options
    ADD PRIMARY KEY (id);

ALTER TABLE cpt_label_options
    ADD FOREIGN KEY (column_id) REFERENCES cpt_custom_columns
        ON DELETE CASCADE;

-- 5. Add include_custom_columns flag to custom_project_templates table
ALTER TABLE custom_project_templates
    ADD COLUMN IF NOT EXISTS include_custom_columns BOOLEAN DEFAULT FALSE;

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_cpt_custom_columns_template_id ON cpt_custom_columns(template_id);
CREATE INDEX IF NOT EXISTS idx_cpt_column_configurations_column_id ON cpt_column_configurations(column_id);
CREATE INDEX IF NOT EXISTS idx_cpt_selection_options_column_id ON cpt_selection_options(column_id);
CREATE INDEX IF NOT EXISTS idx_cpt_label_options_column_id ON cpt_label_options(column_id);
  `);
};

/** @param {import('node-pg-migrate').MigrationBuilder} pgm */
exports.down = async (_pgm) => {
  // This migration is a DDL/function change — no automatic rollback defined.
  // Review manually before running migrate:down.
};
