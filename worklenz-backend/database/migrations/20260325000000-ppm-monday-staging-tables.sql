-- Migration: Create ppm_ staging tables for Monday.com data import
-- These tables hold raw Monday.com data before mapping into Worklenz core tables.

-- Clients from Client Master Board (ID: 18392998217)
CREATE TABLE IF NOT EXISTS ppm_clients (
    id                    UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    monday_item_id        BIGINT UNIQUE NOT NULL,
    name                  TEXT NOT NULL,
    client_status         TEXT,          -- Incoming Leads, Pipeline, In Negotiation, Onboarding, Contracted, Past
    ops_status            TEXT,
    overall_health        TEXT,
    primary_partner       TEXT,          -- Monday People column value
    paid_media_owner      TEXT,
    creative_owner        TEXT,
    retention_owner       TEXT,
    next_milestone        TEXT,
    milestone_date        DATE,
    contracted_scope      TEXT,
    contracted_hours      NUMERIC DEFAULT 0,
    estimated_hours       NUMERIC DEFAULT 0,
    actual_hours          NUMERIC DEFAULT 0,
    hours_remaining       NUMERIC DEFAULT 0,
    pct_used              NUMERIC DEFAULT 0,
    website               TEXT,
    contact_name          TEXT,
    contact_email         TEXT,
    contact_phone         TEXT,
    monday_group          TEXT,          -- which group the item was in
    created_at            TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at            TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Active tasks from Creative Pipeline (ID: 18392999987) and per-client boards
CREATE TABLE IF NOT EXISTS ppm_tasks (
    id                    UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    monday_item_id        BIGINT UNIQUE NOT NULL,
    monday_board_id       BIGINT NOT NULL,
    monday_board_name     TEXT,
    name                  TEXT NOT NULL,
    client_name           TEXT,          -- resolved from board relation
    owner                 TEXT,
    assigned_to           TEXT,
    priority              TEXT,
    task_type             TEXT,          -- e.g. Email, Ad, Social
    channel               TEXT,          -- e.g. Email, Meta, Google
    design_status         TEXT,
    request_status        TEXT,
    approval_date         DATE,
    due_date              DATE,
    send_date             DATE,
    creative_brief        TEXT,
    promotion_details     TEXT,
    products_promoted     TEXT,
    copy_text             TEXT,
    call_to_actions       TEXT,
    estimated_hours       NUMERIC DEFAULT 0,
    actual_hours          NUMERIC DEFAULT 0,
    partner_overflow      BOOLEAN DEFAULT FALSE,
    month_completed       TEXT,
    monday_group          TEXT,          -- workflow stage group name
    created_at            TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at            TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Time tracking entries derived from Monday's manual hour columns
CREATE TABLE IF NOT EXISTS ppm_time_entries (
    id                    UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    monday_item_id        BIGINT NOT NULL,
    monday_board_id       BIGINT NOT NULL,
    task_name             TEXT NOT NULL,
    client_name           TEXT,
    estimated_hours       NUMERIC DEFAULT 0,
    actual_hours          NUMERIC DEFAULT 0,
    month_completed       TEXT,
    source_board          TEXT,          -- which Monday board this came from
    created_at            TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Index for lookups during Worklenz core table mapping
CREATE INDEX idx_ppm_clients_monday_id ON ppm_clients(monday_item_id);
CREATE INDEX idx_ppm_tasks_monday_id ON ppm_tasks(monday_item_id);
CREATE INDEX idx_ppm_tasks_board_id ON ppm_tasks(monday_board_id);
CREATE INDEX idx_ppm_time_entries_item_id ON ppm_time_entries(monday_item_id);
CREATE INDEX idx_ppm_time_entries_client ON ppm_time_entries(client_name);
